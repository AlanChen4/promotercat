import { withApiHandler } from "@/lib/api/handler";
import { parseSearchParams } from "@/lib/schemas/subreddits";
import { searchSubreddits } from "@/lib/subreddits/search";
import { requireSession } from "@/lib/supabase/server";

export const GET = withApiHandler(async (request) => {
  const input = parseSearchParams(new URL(request.url).searchParams);
  if (input.page > 1)
    await requireSession("Sign up or log in to view more results.");
  return Response.json(await searchSubreddits(input));
});
