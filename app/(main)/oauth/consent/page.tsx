import type { Metadata } from "next";
import { OAuthConsent } from "./_components/oauth-consent";

export const metadata: Metadata = {
  title: "Connect your agent | PromoterCat",
  robots: { index: false, follow: false },
};
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string; preview?: string }>;
}) {
  const { authorization_id, preview } = await searchParams;
  return (
    <OAuthConsent
      preview={process.env.NODE_ENV === "development" && preview === "1"}
      authorizationId={
        typeof authorization_id === "string" ? authorization_id : ""
      }
    />
  );
}
