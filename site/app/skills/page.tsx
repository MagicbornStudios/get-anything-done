import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { SiteProse, SiteSection, SiteSectionHeading } from "@/components/site";
import { SKILLS, SKILL_INHERITANCE } from "@/lib/catalog.generated";
import { PRODUCED_ARTIFACTS } from "@/lib/eval-data";

export const metadata = {
  title: "Skills — GAD",
  description:
    "Every authored skill in the GAD framework. Filterable by inheritance status and origin. Click any skill to read the full SKILL.md and copy it.",
};

const FUNDAMENTAL_IDS = new Set([
  "create-skill",
  "merge-skill",
  "find-skills",
  "scientific-method",
  "debug",
]);

interface SkillSummary {
  id: string;
  name: string;
  description: string;
  inheritedBy: string[];
  isFundamental: boolean;
  isFrameworkSkill: boolean;
  authoredByEvals: string[];
}

function buildSkillSummaries(): SkillSummary[] {
  return SKILLS.map((s) => {
    // Find every eval run that produced a skill file matching this skill's id
    const authoredByEvals: string[] = [];
    for (const [runKey, artifacts] of Object.entries(PRODUCED_ARTIFACTS)) {
      if (
        artifacts.skillFiles?.some(
          (f) =>
            f.name === `${s.id}.md` ||
            f.name === `${s.id}/SKILL.md` ||
            f.name.startsWith(`${s.id}-`)
        )
      ) {
        authoredByEvals.push(runKey);
      }
    }

    return {
      id: s.id,
      name: s.name,
      description: s.description,
      inheritedBy: SKILL_INHERITANCE[s.id] ?? [],
      isFundamental: FUNDAMENTAL_IDS.has(s.id),
      isFrameworkSkill: s.frameworkSkill === true,
      authoredByEvals,
    };
  });
}

function categoryFor(s: SkillSummary): string {
  if (s.isFundamental) return "fundamental";
  if (s.authoredByEvals.length > 0) return "eval-authored";
  if (s.inheritedBy.length > 0) return "framework-inherited";
  return "framework-only";
}

const CATEGORY_LABEL: Record<string, string> = {
  fundamental: "Fundamental",
  "eval-authored": "Eval-authored",
  "framework-inherited": "Framework — inherited by evals",
  "framework-only": "Framework — not yet inherited",
};

const CATEGORY_DESCRIPTION: Record<string, string> = {
  fundamental:
    "The triumvirate (gad-73) plus root primitives. These are the skills the emergent workflow merges from when authoring project-tailored variants.",
  "eval-authored":
    "Skills that originated inside an eval run. Provenance flows from a specific run + its rubric scores. CSH evidence — these are the skills that test whether the compound-skills hypothesis is real.",
  "framework-inherited":
    "Skills the main GAD framework provides AND that at least one eval template copies into its bootstrap skill set. Battle-tested across rounds.",
  "framework-only":
    "Skills available to the main GAD agent but not yet inherited by any eval. May be too generic, too specific, or simply not picked up yet.",
};

const CATEGORY_TINT: Record<string, string> = {
  fundamental: "border-amber-500/40 bg-amber-500/5",
  "eval-authored": "border-emerald-500/40 bg-emerald-500/5",
  "framework-inherited": "border-sky-500/40 bg-sky-500/5",
  "framework-only": "border-zinc-500/40 bg-zinc-500/5",
};

const CATEGORY_ORDER = [
  "fundamental",
  "eval-authored",
  "framework-inherited",
  "framework-only",
];

export default function SkillsIndexPage() {
  const summaries = buildSkillSummaries();
  const grouped: Record<string, SkillSummary[]> = {};
  for (const s of summaries) {
    const cat = categoryFor(s);
    (grouped[cat] ??= []).push(s);
  }
  for (const k of Object.keys(grouped)) {
    grouped[k].sort((a, b) => a.id.localeCompare(b.id));
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <SiteSection>
        <SiteSectionHeading
          kicker="Skills"
          as="h1"
          preset="hero"
          title={
            <>
              Every authored skill. <span className="gradient-text">With provenance.</span>
            </>
          }
        />
        <SiteProse className="mt-6">
          The GAD skill catalog. Each skill is a SKILL.md file authored either inside the framework,
          inherited from an upstream, or produced by an eval run. Open any skill to read its full
          markdown and copy it verbatim. Per{" "}
          <Link href="/decisions#gad-73" className="text-accent underline decoration-dotted">
            gad-73
          </Link>{" "}
          the fundamental triumvirate (find-skills + merge-skill + create-skill) is the foundational
          set.
        </SiteProse>
        <SiteProse size="sm" className="mt-4">
          Provenance per skill (origin run, inheritance lineage, evaluation performance context) per{" "}
          <Link href="/decisions#gad-76" className="text-accent underline decoration-dotted">
            gad-76
          </Link>
          . GAD skills follow the format specified in the{" "}
          <Link href="/standards" className="text-accent underline decoration-dotted">
            Anthropic skills guide + agentskills.io standard
          </Link>{" "}
          — read{" "}
          <Link href="/standards" className="text-accent underline decoration-dotted">
            /standards
          </Link>{" "}
          for progressive disclosure, discovery conventions, collision handling, and the per-skill
          evaluation methodology.
        </SiteProse>
        <div className="mt-4 max-w-3xl rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-[13px] leading-6 text-rose-200">
            <strong className="text-rose-100">Findability warning:</strong>{" "}
            <code className="rounded bg-background/60 px-1 py-0.5 text-xs">gad install</code>{" "}
            does NOT copy these workspace skills to user projects today. They
            are only visible to agents working inside the GAD repo itself.
            The fix is tracked as task 22-46 (adopt{" "}
            <code className="rounded bg-background/60 px-1 py-0.5 text-xs">.agents/skills/</code>{" "}
            convention). Full writeup in{" "}
            <a
              href="https://github.com/MagicbornStudios/get-anything-done/blob/main/.planning/docs/SKILL-FINDABILITY-2026-04-09.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-100 underline decoration-dotted"
            >
              .planning/docs/SKILL-FINDABILITY-2026-04-09.md
            </a>
            .
          </div>

          <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Stat label="Total skills" value={summaries.length.toString()} />
            <Stat label="Fundamental" value={(grouped.fundamental?.length ?? 0).toString()} />
            <Stat
              label="Eval-authored"
              value={(grouped["eval-authored"]?.length ?? 0).toString()}
            />
            <Stat
              label="Framework-inherited"
              value={(grouped["framework-inherited"]?.length ?? 0).toString()}
            />
          </div>
      </SiteSection>

      {CATEGORY_ORDER.filter((c) => grouped[c]?.length > 0).map((cat) => (
        <SiteSection
          key={cat}
          id={`category-${cat}`}
          className={`last:border-b-0 last:bg-background ${CATEGORY_TINT[cat] ?? ""}`}
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SiteSectionHeading
              icon={Sparkles}
              kicker={CATEGORY_LABEL[cat]}
              kickerRowClassName="mb-0 flex-1 gap-3"
              className="min-w-0 flex-1"
            />
            <Badge variant="outline" className="shrink-0">
              {grouped[cat].length}
            </Badge>
          </div>
          <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
            {CATEGORY_DESCRIPTION[cat]}
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {grouped[cat].map((s) => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
        </SiteSection>
      ))}

      <Footer />
    </main>
  );
}

function SkillCard({ skill }: { skill: SkillSummary }) {
  return (
    <Link href={`/skills/${skill.id}`} className="block">
      <Card className="h-full transition-colors hover:border-accent/60">
        <CardHeader className="pb-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {skill.isFundamental && (
              <Badge variant="default" className="bg-amber-500/15 text-amber-300">
                fundamental
              </Badge>
            )}
            {skill.isFrameworkSkill && (
              <Badge variant="outline" className="border-violet-500/50 text-violet-300">
                Framework
              </Badge>
            )}
            {skill.authoredByEvals.length > 0 && (
              <Badge variant="outline" className="text-emerald-300">
                eval-authored
              </Badge>
            )}
          </div>
          <CardTitle className="font-mono text-base">{skill.id}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
            {skill.description}
          </p>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {skill.inheritedBy.length > 0
                ? `inherited by ${skill.inheritedBy.length}`
                : "framework-only"}
            </span>
            <ArrowRight size={11} aria-hidden />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
