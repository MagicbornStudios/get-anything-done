import Link from "next/link";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { Ref } from "@/components/refs/Ref";

export function SecurityHeroSection() {
  return (
    <SiteSection cid="security-hero-section-site-section">
      <SiteSectionHeading
        kicker="Security"
        as="h1"
        preset="hero"
        title={
          <>
            Skills are code. <span className="gradient-text">Code is a threat surface.</span>
          </>
        }
      />
      <SiteProse className="mt-6">
        Skills extend a coding agent&apos;s prompt with instructions it will follow, sometimes including the right to
        run commands, write files, and touch the repo. That makes every skill a potential threat surface. This page does
        two jobs: it explains the threat model, and it shows the operational telemetry and audit artifacts backing the
        framework&apos;s current claims.
      </SiteProse>
      <SiteProse size="sm" className="mt-4">
        Anchor decision: <Ref id="gad-70" /> (Anthropic skills guide as canonical reference) · see also{" "}
        <Link href="/standards" className="text-accent underline decoration-dotted">
          /standards
        </Link>
        , related: <Ref id="gad-73" /> (fundamental skills triumvirate) and <Ref id="gad-74" /> (skill security as a
        long-term goal).
      </SiteProse>

      <div className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">
        <strong className="text-amber-100">Important:</strong> GAD does not currently host third-party skills. Every
        skill in our catalog was authored inside this repo or inherited from a small set of trusted upstreams. This page
        describes attacks that apply to the broader coding-agent ecosystem so you know what to watch for when evaluating
        skills from <em>other</em> sources.
      </div>
    </SiteSection>
  );
}

