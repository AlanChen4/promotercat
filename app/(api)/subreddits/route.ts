import { withApiHandler } from "@/lib/api-handler";
import { requireSession } from "@/lib/api-session";
import { searchSubreddits } from "@/lib/search-subreddits";

export const GET = withApiHandler(async (request) => {
  const parsed = Number(new URL(request.url).searchParams.get("page"));
  const requestedPage =
    Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
  if (requestedPage > 1)
    await requireSession("Sign up or log in to view more results.");
  return searchSubreddits(request);
});
