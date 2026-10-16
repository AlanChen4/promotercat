import type { Metadata } from "next";
import Image from "next/image";
import logo from "@/public/logo.png";

export const metadata: Metadata = {
  title: "Privacy Policy | PromoterCat",
  description: "How PromoterCat collects and uses your information.",
};

export default function PrivacyPage() {
  return (
    <>
      <div className="flex items-center gap-3">
        <Image
          src={logo}
          alt="PromoterCat"
          width={40}
          height={40}
          className="shrink-0"
        />
        <h1>Privacy Policy</h1>
      </div>
      <p className="text-muted-foreground">Last updated: October 15, 2026</p>
      <p>
        PromoterCat helps you find subreddits where you can promote your
        product. This policy explains how we handle information when you use the
        service.
      </p>
      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>
            Account information: when you sign in with Google, we receive your
            email address, name, profile picture, and account identifier. We do
            not receive your Google password.
          </li>
          <li>
            Agent connections: when you approve an agent, Supabase manages its
            authorization grant, sessions, and access and refresh tokens. We use
            your account identifier and request counts for the current minute
            and day to authenticate searches and enforce limits. You can stop
            using the plugin at any time. Issued access tokens remain valid
            until they expire.
          </li>
          <li>
            Search information: we process the search text and filters you enter
            to find relevant subreddits. Do not include confidential or
            sensitive personal information in searches.
          </li>
          <li>
            Usage and technical information: analytics and error reports may
            include pages visited, interactions, browser and device details, IP
            addresses, and diagnostic data. Signed-in activity may be associated
            with your account identifier and email address.
          </li>
        </ul>
      </section>
      <section>
        <h2>How we use and share information</h2>
        <p>
          We use this information to sign you in, provide search results,
          understand usage, fix errors, and protect the service. We use Supabase
          for authentication and data storage, Google for sign-in, PostHog and
          Vercel Analytics for usage analytics, and Sentry for error monitoring.
          Search text is sent through Vercel AI Gateway to an AI model provider
          to generate search embeddings. These providers process information to
          support the service under their own terms and privacy policies.
        </p>
        <p>
          We may also disclose information when required by law or when needed
          to address fraud, abuse, or threats to the service or its users.
        </p>
      </section>
      <section>
        <h2>Cookies and browser storage</h2>
        <p>
          We and our providers use cookies or browser storage to maintain your
          session and support analytics. You can clear or block this storage in
          your browser settings, but some features may stop working. Signing out
          ends your session; it does not delete your account.
        </p>
      </section>
      <section>
        <h2>Retention and security</h2>
        <p>
          We retain information as needed to operate the service, meet legal
          obligations, and resolve disputes. Retention periods vary by data type
          and provider. No method of storage or transmission is completely
          secure. Our providers may process data outside your country.
        </p>
      </section>
      <section>
        <h2>Your choices and requests</h2>
        <p>
          You can request access to, correction of, or deletion of your personal
          information by emailing{" "}
          <a href="mailto:wherecanipromote@gmail.com">
            wherecanipromote@gmail.com
          </a>
          . We may need to verify your identity before acting on a request. Your
          rights depend on the laws that apply to you, and some records may need
          to be retained for legal or security reasons.
        </p>
      </section>
      <section>
        <h2>Children</h2>
        <p>
          PromoterCat is not intended for children under 13. If you believe a
          child has provided personal information, contact us so we can address
          it.
        </p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update this policy as the service changes. We will post updates
          here and revise the date above. For privacy questions, email{" "}
          <a href="mailto:wherecanipromote@gmail.com">
            wherecanipromote@gmail.com
          </a>
          .
        </p>
      </section>
    </>
  );
}
