import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";
import { redirect } from "next/navigation.js";

// Next.js resolves this extensionless entry point when bundling. Node's native
// TypeScript runner needs the file extension when testing outside Next.js.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === "next/navigation" ? "next/navigation.js" : specifier,
      context,
    );
  },
});
const { ApiError, callService, withApiHandler } = await import(
  "../lib/api-handler.ts"
);
hooks.deregister();

const request = () =>
  new Request("http://localhost/api/test?token=secret", {
    headers: { Authorization: "Bearer secret" },
  });

test("preserves response bodies, redirects, and protocol headers", async () => {
  const handler = withApiHandler(
    () =>
      new Response("limited", {
        status: 429,
        headers: {
          "Retry-After": "20",
          "WWW-Authenticate": "Bearer",
          "Cache-Control": "public, max-age=60",
        },
      }),
  );
  const response = await handler(request());
  assert.equal(response.status, 429);
  assert.equal(await response.text(), "limited");
  assert.equal(response.headers.get("Retry-After"), "20");
  assert.equal(response.headers.get("WWW-Authenticate"), "Bearer");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const redirected = await withApiHandler(() =>
    Response.redirect("http://localhost/account", 303),
  )(request());
  assert.equal(redirected.status, 303);
  assert.equal(redirected.headers.get("Location"), "http://localhost/account");
});

test("preserves separate cookies and streams without consuming the body", async () => {
  const headers = new Headers();
  headers.append("Set-Cookie", "first=1; HttpOnly");
  headers.append("Set-Cookie", "second=2; HttpOnly");
  const source = new Response("streamed content", { headers });
  const response = await withApiHandler(() => source)(request());
  assert.equal(response.body, source.body);
  assert.deepEqual(response.headers.getSetCookie(), [
    "first=1; HttpOnly",
    "second=2; HttpOnly",
  ]);
  assert.equal(await response.text(), "streamed content");
});

test("public caching requires opt-in and never applies to failures", async (t) => {
  t.mock.method(console, "error", () => {});
  const options = { cacheControl: "public, max-age=300" };
  const success = await withApiHandler(
    () => Response.json({ ok: true }),
    options,
  )(request());
  assert.equal(success.headers.get("Cache-Control"), options.cacheControl);
  const failure = await withApiHandler(() => {
    throw new ApiError(503, "Unavailable");
  }, options)(request());
  assert.equal(failure.headers.get("Cache-Control"), "private, no-store");
});

test("known service failures are 503; bugs are sanitized 500s", async (t) => {
  const logger = t.mock.method(console, "error", () => {});
  const service = await withApiHandler(() =>
    callService("Auth unavailable", async () => {
      throw new Error("sensitive upstream error");
    }),
  )(request());
  assert.equal(service.status, 503);
  assert.deepEqual(await service.json(), { message: "Auth unavailable" });
  const bug = await withApiHandler(() => {
    throw new TypeError("secret bug detail");
  })(request());
  assert.equal(bug.status, 500);
  assert.deepEqual(await bug.json(), {
    message: "An unexpected error occurred. Please try again.",
  });
  const logs = JSON.stringify(logger.mock.calls);
  assert.ok(!logs.includes("secret"));
  assert.ok(!logs.includes("sensitive"));
  assert.match(logs, /api\/test/);
});

test("Next.js redirect control flow passes through both boundaries", async () => {
  const handler = withApiHandler(() =>
    callService("Unavailable", async () => redirect("/account")),
  );
  await assert.rejects(handler(request()), (error) =>
    error.digest?.startsWith("NEXT_REDIRECT;"),
  );
});

// Ensure no mocks escape into other suites.
test.after(() => mock.restoreAll());
