import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/(api)/subreddits/route";

const { from, rpc, query, embedContent } = vi.hoisted(() => {
  const query = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn(),
  };
  return {
    query,
    from: vi.fn(() => query),
    rpc: vi.fn(),
    embedContent: vi.fn(),
  };
});

vi.mock("@/lib/supabase/admin-server", () => ({
  createAdminClient: async () => ({ from, rpc }),
}));
vi.mock("@/lib/gemini", () => ({
  createGeminiClient: () => ({ models: { embedContent } }),
}));

const subreddits = Array.from({ length: 25 }, (_, index) => ({
  name: `community${String(index).padStart(2, "0")}`,
  self_promotion: "allowed_full",
  self_promotion_detail: "",
  members_count: (index + 1) * 50_000,
}));

async function request(params = "", headers?: HeadersInit) {
  return GET(new Request(`http://localhost/subreddits?${params}`, { headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  query.range.mockImplementation(async (start: number, end: number) => ({
    data: subreddits.slice(start, end + 1),
    error: null,
    count: subreddits.length,
  }));
  embedContent.mockResolvedValue({ embeddings: [{ values: [0.1, 0.2] }] });
  rpc.mockResolvedValue({ data: subreddits, error: null });
});

describe("free subreddit search", () => {
  it("returns ten real results to visitors without an account", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      subreddits: subreddits.slice(0, 10),
      totalCount: 25,
      page: 1,
      pageSize: 10,
    });
    expect(from).toHaveBeenCalledExactlyOnceWith("subreddits");
  });

  it.each([
    undefined,
    { cookie: "sb-access-token=existing-session" },
  ])("returns page two regardless of session cookies (%j)", async (headers) => {
    const response = await request("page=2", headers);
    expect(await response.json()).toEqual({
      subreddits: subreddits.slice(10, 20),
      totalCount: 25,
      page: 2,
      pageSize: 10,
    });
  });

  it("allows sorting and member filters without an account", async () => {
    await request(
      "sort_by=name&sort_direction=desc&min_members=50000&max_members=1000000",
    );
    expect(query.order).toHaveBeenCalledWith("name", { ascending: false });
    expect(query.gte).toHaveBeenCalledWith("members_count", 50_000);
    expect(query.lte).toHaveBeenCalledWith("members_count", 1_000_000);
  });

  it("paginates and sorts semantic search without an account", async () => {
    const response = await request(
      "search=games&page=2&sort_by=name&sort_direction=desc",
    );
    const body = await response.json();
    expect(body).toEqual({
      subreddits: [...subreddits].reverse().slice(10, 20),
      totalCount: 25,
      page: 2,
      pageSize: 10,
    });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("returns the last page and preserves input validation", async () => {
    const lastPage = await request("page=3");
    expect((await lastPage.json()).subreddits).toEqual(subreddits.slice(20));
    const invalidPage = await request("page=-1");
    expect((await invalidPage.json()).page).toBe(1);
  });
});
