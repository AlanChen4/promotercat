import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import logo from "@/public/logo.png";

export const metadata: Metadata = {
  title: "Terms of Service | PromoterCat",
  description: "The terms for using PromoterCat.",
};

export default function TermsPage() {
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
        <h1>Terms of Service</h1>
      </div>
      <p className="text-muted-foreground">Last updated: October 15, 2026</p>
      <p>
        By using PromoterCat, you agree to these terms. If you do not agree, do
        not use the service. You must be at least 13 and meet any higher minimum
        age required by applicable law. If you cannot enter into these terms on
        your own, you need permission from a parent or guardian.
      </p>
      <section>
        <h2>Using the service</h2>
        <p>
          PromoterCat helps you discover subreddits and understand their
          promotion rules. Results may be incomplete, outdated, or incorrect.
          Always check the current subreddit rules and Reddit policies before
          posting. We do not guarantee that a post will be allowed or produce
          any particular result. PromoterCat is not affiliated with or endorsed
          by Reddit or individual subreddit moderators.
        </p>
      </section>
      <section>
        <h2>Your account and responsibilities</h2>
        <p>
          You are responsible for protecting your sign-in credentials and for
          activity through your account. Use the service lawfully. Do not use it
          to spam, harass others, violate third-party rights, bypass access
          controls, disrupt the service, or access information without
          permission. You are responsible for the content you submit and post
          elsewhere.
        </p>
      </section>
      <section>
        <h2>Privacy and third-party services</h2>
        <p>
          Our <Link href="/privacy">Privacy Policy</Link> explains how we handle
          information. Third-party services and linked websites, including
          Google and Reddit, have their own terms and policies.
        </p>
      </section>
      <section>
        <h2>Availability and changes</h2>
        <p>
          We may change, suspend, or discontinue features. We may restrict
          access to address abuse, security risks, or violations of these terms.
          You can stop using the service at any time. To request account
          deletion, email{" "}
          <a href="mailto:wherecanipromote@gmail.com">
            wherecanipromote@gmail.com
          </a>
          .
        </p>
      </section>
      <section>
        <h2>Disclaimers and liability</h2>
        <p>
          To the extent permitted by law, the service is provided “as is” and
          “as available,” without warranties of accuracy, availability, or
          fitness for a particular purpose. We are not liable for indirect or
          consequential losses arising from your use of the service. Nothing in
          these terms excludes rights or liability that cannot be excluded under
          applicable law.
        </p>
      </section>
      <section>
        <h2>Updates and contact</h2>
        <p>
          We may update these terms and will post the revised version here with
          a new date. For questions about these terms, email{" "}
          <a href="mailto:wherecanipromote@gmail.com">
            wherecanipromote@gmail.com
          </a>
          .
        </p>
      </section>
    </>
  );
}
