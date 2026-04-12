import Link from "next/link";
import { FileWarning } from "lucide-react";
import { SiteSection, SiteSectionHeading } from "@/components/site";

export function SecurityCertificationSection() {
  return (
    <SiteSection tone="muted">
      <SiteSectionHeading
        icon={FileWarning}
        kicker="Where this is headed - skill certification"
        kickerRowClassName="mb-6 gap-3"
        iconClassName="text-amber-400"
      />
      <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
        A longer-term research direction is a certification model for skills produced inside this system. That would be a
        claim about the build process and provenance of the skill, not a blanket claim that the skill is safe in every
        environment.
      </p>
      <ul className="mb-6 space-y-2 text-sm leading-6 text-muted-foreground">
        <li>Origin run ID and rubric context.</li>
        <li>Pressure tier of the run that produced the skill.</li>
        <li>Inheritance lineage and changelog disposition over time.</li>
        <li>Signed manifests or tamper-evident content hashes.</li>
      </ul>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        None of that is built yet. See the{" "}
        <Link href="/questions#skill-security-model" className="text-accent underline decoration-dotted">
          open question
        </Link>{" "}
        for the current state of that work.
      </p>
    </SiteSection>
  );
}
