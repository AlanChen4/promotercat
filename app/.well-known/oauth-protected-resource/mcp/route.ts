import { NextResponse } from "next/server";
import { oauthMetadata } from "@/lib/agent-oauth";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(
  (request) => {
    return NextResponse.json(oauthMetadata(request), {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
  { cacheControl: "public, max-age=300" },
);
