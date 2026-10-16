import type { Metadata } from "next";
import { OAuthConsent } from "./_components/oauth-consent";

export const metadata: Metadata = {
  title: "Connect your agent | PromoterCat",
  robots: { index: false, follow: false },
};
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id } = await searchParams;
  return (
    <OAuthConsent
      authorizationId={
        typeof authorization_id === "string" ? authorization_id : ""
      }
    />
  );
}
