import { NextResponse } from "next/server";
import { oauthMetadata } from "@/lib/agent-oauth";

export function GET(request: Request) {
  return NextResponse.json(oauthMetadata(request), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
