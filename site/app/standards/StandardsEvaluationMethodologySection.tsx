import Link from "next/link";
import { Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Identified } from "@/components/devid/Identified";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { AGENTSKILLS_URL } from "./standards-shared";

export default function StandardsEvaluationMethodologySection() {
  return (
    <SiteSection cid="standards-evaluation-methodology-section-site-section" tone="muted">
      <Identified as="StandardsEvaluationMethodologySection">
      <SiteSectionHeading
        icon={Gauge}
        kicker="Per-skill evaluation methodology"
        kickerRowClassName="mb-6 gap-3"
      />
      <SiteProse size="sm" className="mb-6">
        Directly from{" "}
        <a
          href={`${AGENTSKILLS_URL}/skill-creation/evaluating-skills`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-dotted"
        >
          agentskills.io/skill-creation/evaluating-skills
        </a>
        . Distinct from GAD&apos;s eval-project rubric (which scores a whole build like
        escape-the-dungeon). This methodology scores individual skills.
      </SiteProse>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">1. Test cases in evals/evals.json</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Every skill stores its test cases alongside it. Each test has a prompt, an
            expected-output description, optional input files, and assertions. Start with 2-3 cases,
            expand after the first iteration.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">2. Run each case twice</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            <strong className="text-foreground">with_skill vs without_skill</strong>. Same prompt,
            same inputs, clean context. The baseline (no skill) is what the agent does on its own.
            Improving over baseline is what you&apos;re measuring.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">3. Capture timing</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Tokens and duration per run, stored in{" "}
            <code className="rounded bg-background/60 px-1 py-0.5 text-xs">timing.json</code>. Lets you
            see the cost of the skill, not just the benefit.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">4. Grade assertions + iterate</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
            Each assertion gets PASS or FAIL with concrete evidence. All iterations aggregate into{" "}
            <code className="rounded bg-background/60 px-1 py-0.5 text-xs">benchmark.json</code> with
            delta (with_skill − without_skill) per metric. The loop is: grade → review → propose
            improvements → rerun → grade.
          </CardContent>
        </Card>
      </div>
      <p className="mt-6 max-w-3xl text-xs leading-6 text-muted-foreground">
        <strong className="text-foreground">GAD adoption status:</strong> not yet. The per-skill
        methodology is queued under task 22-50 + the triumvirate audit. Once built, per-skill
        evaluation is the direct answer to the programmatic-eval gap{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 text-xs">G2</code> in{" "}
        <Link href="/data" className="text-accent underline decoration-dotted">
          .planning/docs/GAPS.md
        </Link>{" "}
        (skill-trigger coverage) and the per-skill effectiveness half of{" "}
        <code className="rounded bg-card/60 px-1 py-0.5 text-xs">G11</code> (skill-inheritance
        hygiene).
      </p>
      </Identified>
    </SiteSection>
  );
}

