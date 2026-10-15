import { NextResponse } from "next/server";
import { searchSubreddits } from "@/lib/search-subreddits";
import { createClient } from "@/lib/supabase/server";

const RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const parsed = Number(new URL(request.url).searchParams.get("page"));
  const requestedPage =
    Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
  if (requestedPage > 1) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (
      error &&
      (error.status === undefined ||
        error.status === 0 ||
        error.status === 429 ||
        error.status >= 500)
    ) {
      return NextResponse.json(
        { message: "Unable to verify your session. Please try again." },
        { status: 503, headers: RESPONSE_HEADERS },
      );
    }
    if (error || !user || user.is_anonymous) {
      return NextResponse.json(
        { message: "Sign up or log in to view more results." },
        { status: 401, headers: RESPONSE_HEADERS },
      );
    }
  }
  return searchSubreddits(request);
}
