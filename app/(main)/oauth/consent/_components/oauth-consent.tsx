"use client";

import type { OAuthAuthorizationDetails } from "@supabase/supabase-js";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import logo from "@/public/logo.png";
import { SignInOptions } from "../../../_components/sign-in-options";

export function OAuthConsent({ authorizationId }: { authorizationId: string }) {
  const { user, isAuthenticated, isAuthenticatedLoading } = useAuth();
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(
    null,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isAuthenticated || !authorizationId) return;
    let active = true;
    setDetails(null);
    setError("");
    createClient()
      .auth.oauth.getAuthorizationDetails(authorizationId)
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setError(
            "This connection request is invalid or has expired. Start connecting again from your agent.",
          );
          return;
        }
        if ("redirect_url" in data) {
          window.location.assign(data.redirect_url);
          return;
        }
        setDetails(data);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not load this connection request. Please try again from your agent.",
          );
      });
    return () => {
      active = false;
    };
  }, [authorizationId, isAuthenticated]);

  return (
    <article
      className="ph-no-capture ph-no-record mx-auto max-w-lg space-y-5 rounded-xl border bg-card p-6 text-sm leading-6 shadow-sm"
      data-ph-no-capture
      data-ph-no-record
    >
      <div className="flex items-center gap-3">
        <Image src={logo} alt="PromoterCat" width={40} height={40} />
        <h1 className="text-xl font-semibold">Connect your agent</h1>
      </div>
      {!authorizationId ? (
        <p role="alert">
          Missing connection request. Start connecting from your agent.
        </p>
      ) : isAuthenticatedLoading ? (
        <p>Loading your account…</p>
      ) : !isAuthenticated ? (
        <>
          <p>Sign in to PromoterCat to connect your agent.</p>
          <SignInOptions
            returnTo={`/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`}
          />
        </>
      ) : error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : !details ? (
        <p>Loading connection request…</p>
      ) : (
        <>
          <p>
            <strong>{details.client.name || "An agent"}</strong> wants to
            connect to your PromoterCat account.
          </p>
          <p className="text-muted-foreground">
            Signed in as {user?.email}. This connection can find communities and
            read their promotion rules. It cannot post to Reddit.
          </p>
          <div className="space-y-2 rounded-md bg-muted p-3">
            <p className="font-medium">Requested account information</p>
            <ul className="list-disc pl-5">
              {details.scope
                .split(/\s+/)
                .filter(Boolean)
                .map((scope) => (
                  <li key={scope}>
                    {{
                      email: "Your email address",
                      profile: "Your name and profile picture",
                      openid: "Your account identifier",
                      phone: "Your phone number",
                    }[scope] ?? scope}
                  </li>
                ))}
            </ul>
          </div>
          <p className="break-all text-xs text-muted-foreground">
            After approval, return to: {details.redirect_uri}
          </p>
          <p className="text-xs text-muted-foreground">
            Only approve clients you trust. Limits are shared across your
            connected agents: 30 searches per UTC minute and 1,000 per UTC day.
            You can disconnect an agent from the For Agents window.
          </p>
          <form
            method="POST"
            action="/api/oauth/decision"
            className="flex gap-3"
          >
            <input
              type="hidden"
              name="authorization_id"
              value={authorizationId}
            />
            <Button type="submit" name="decision" value="approve">
              Connect
            </Button>
            <Button
              type="submit"
              name="decision"
              value="deny"
              variant="outline"
            >
              Cancel
            </Button>
          </form>
        </>
      )}
    </article>
  );
}
