import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Beaker,
  Download,
  FileText,
  PackageCheck,
  Scissors,
} from "lucide-react";
import { Identified } from "gad-visual-context";
import { SiteSection, SiteSectionIntro } from "@/components/site";
import { SKILLS, GITHUB_REPO } from "@/lib/catalog.generated";

type LoopStep = {
  key: string;
  kicker: string;
  title: string;
  blurb: string;
  artifact: string;
  icon: typeof Activity;
  command?: string;
};

const LOOP_STEPS: LoopStep[] = [
  {
    key: "detect",
    kicker: "1. Detect",
    title: "Pressure surfaces a pattern",
    blurb:
      "Self-eval walks the task registry and decisions and flags any phase that clears the threshold from the P = T + Cₐwc + Clwl + D·wd + (D/T)·wr formula.",
    artifact: ".planning/self-eval.json",
    icon: Activity,
    command: "gad self-eval",
  },
  {
    key: "candidate",
    kicker: "2. Candidate",
    title: "Raw phase dump, not a curated brief",
    blurb:
      "Each high-pressure phase gets a CANDIDATE.md — tasks, decisions, crosscuts, file refs. No pre-digestion; the drafter decides what matters.",
    artifact: ".planning/candidates/<slug>/CANDIDATE.md",
    icon: FileText,
  },
  {
    key: "proto",
    kicker: "3. Draft",
    title: "Proto-skill lands in a lock-marked bundle",
    blurb:
      "create-proto-skill writes PROVENANCE.md first, then workflow.md, then a sub-200-line SKILL.md. Crash-resumable, one slug at a time.",
    artifact: ".planning/proto-skills/<slug>/SKILL.md",
    icon: Beaker,
    command: "gad evolution evolve",
  },
  {
    key: "install",
    kicker: "4. Install",
    title: "Promote or equip the skill",
    blurb:
      "Validator adds advisory notes. You promote into skills/, merge into a sibling, or equip per-project with gad skill promote.",
    artifact: "skills/<skill-name>/SKILL.md",
    icon: PackageCheck,
    command: "gad evolution install <slug>",
  },
  {
    key: "shed",
    kicker: "5. Shed",
    title: "Drop what the next generation won't need",
    blurb:
      "Epigenetic skills build once and uninstall. Species DNA tracks active / epigenetic / shed so the load stays honest (decision gad-221).",
    artifact: "species.json activeSkills ⇢ shedSkills",
    icon: Scissors,
  },
];

const FEATURED_SKILL_IDS = [
  "create-proto-skill",
  "gad-visual-context-system",
  "find-sprites",
] as const;

const GITHUB_RAW_PREFIX = `${GITHUB_REPO}/blob/main/`;
const GITHUB_DOWNLOAD_PREFIX = GITHUB_REPO.replace("github.com", "raw.githubusercontent.com") + "/main/";

function skillPreviewLines(bodyRaw: string): string[] {
  const stripped = bodyRaw
    .replace(/^\s+/, "")
    .split("\n")
    .filter((line) => !/^---/.test(line));
  const out: string[] = [];
  for (const line of stripped) {
    out.push(line);
    if (out.length >= 14) break;
  }
  return out;
}

function FeaturedSkillCard({ skillId }: { skillId: string }) {
  const skill = SKILLS.find((s) => s.id === skillId);
  if (!skill) return null;

  const filePath = skill.file.replace(/^vendor\/get-anything-done\//, "");
  const rawPath = skill.file.replace(/^vendor\/get-anything-done\//, "");
  const viewHref = `${GITHUB_RAW_PREFIX}${rawPath}`;
  const downloadHref = `${GITHUB_DOWNLOAD_PREFIX}${rawPath}`;
  const previewLines = skillPreviewLines(skill.bodyRaw);

  return (
    <Identified
      as={`LandingEvolutionLoopFeaturedSkill-${skill.id}`}
      className="flex min-w-0 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/50 bg-muted/15 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-2 rounded-full bg-accent/70" aria-hidden />
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {filePath}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-border/50 bg-background/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            SKILL.md
          </span>
        </div>

        <div className="flex min-h-[11rem] flex-1 flex-col gap-3 border-b border-border/40 bg-background/40 px-4 py-3">
          <div>
            <p className="font-mono text-sm font-semibold text-foreground">
              {skill.name}
            </p>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {skill.description}
            </p>
          </div>
          <pre className="mt-auto overflow-hidden rounded-md border border-border/50 bg-background/70 px-3 py-2 font-mono text-[11px] leading-snug text-foreground/85">
            {previewLines.join("\n")}
            {"\n…"}
          </pre>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs">
          <Link
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            View on GitHub
          </Link>
          <a
            href={downloadHref}
            download
            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1 font-medium text-foreground transition-colors hover:border-accent/70 hover:text-accent"
          >
            <Download size={12} aria-hidden />
            Download
          </a>
        </div>
      </div>
    </Identified>
  );
}

function LoopStepCard({ step, index, total }: { step: LoopStep; index: number; total: number }) {
  const Icon = step.icon;
  const isLast = index === total - 1;
  return (
    <Identified
      as={`LandingEvolutionLoopStep-${step.key}`}
      className="relative flex min-w-0 flex-col"
    >
      <div className="flex min-h-full flex-col rounded-2xl border border-border/60 bg-card/40 p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
            <Icon size={16} aria-hidden />
          </span>
          <p className="section-kicker !mb-0">{step.kicker}</p>
        </div>
        <p className="mt-3 text-sm font-semibold leading-snug text-foreground">{step.title}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.blurb}</p>
        <div className="mt-4 space-y-1.5 border-t border-border/40 pt-3">
          <p className="font-mono text-[11px] text-muted-foreground/90">
            <span className="mr-1 text-muted-foreground/60">artifact</span>
            <span className="text-foreground/85">{step.artifact}</span>
          </p>
          {step.command ? (
            <p className="font-mono text-[11px] text-accent/90">
              <span className="mr-1 text-muted-foreground/60">command</span>
              {step.command}
            </p>
          ) : null}
        </div>
      </div>
      {!isLast ? (
        <ArrowRight
          size={16}
          aria-hidden
          className="pointer-events-none absolute right-[-0.7rem] top-1/2 hidden -translate-y-1/2 text-accent/50 lg:block"
        />
      ) : null}
    </Identified>
  );
}

/**
 * Home band explaining the evolution loop (detect → candidate → proto-skill →
 * install → shed) and surfacing a few real SKILL.md files for direct download.
 * Sits right after the hero evolution band so the formula card has a concrete
 * downstream flow before the site dives into graphing chaos / VCS / playable.
 */
export function LandingEvolutionLoopBand() {
  return (
    <SiteSection
      id="evolution-loop"
      cid="evolution-loop-site-section"
      className="border-t border-border/60 bg-gradient-to-b from-background via-muted/[0.035] to-background"
    >
      <Identified as="LandingEvolutionLoopBand">
        <SiteSectionIntro
          kicker="How skills form"
          preset="hero-compact"
          title={
            <>
              From pressure to a skill you can <span className="gradient-text">install or shed.</span>
            </>
          }
          proseSize="md"
          proseClassName="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          The same pressure gauge that scores a phase also names which patterns deserve to become
          reusable skills. Every step below is a file on disk and a single CLI invocation — no
          curator in the middle, no LLM interpretation layer, just artifacts and grep-friendly
          names.
        </SiteSectionIntro>

        <Identified
          as="LandingEvolutionLoopSteps"
          className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5 lg:gap-6"
        >
          {LOOP_STEPS.map((step, index) => (
            <LoopStepCard
              key={step.key}
              step={step}
              index={index}
              total={LOOP_STEPS.length}
            />
          ))}
        </Identified>

        <div className="mt-14">
          <Identified as="LandingEvolutionLoopFeaturedSkillsHeader" className="block">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-kicker">Try one now</p>
                <h3 className="mt-1 max-w-2xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                  Featured skills, shown the way an agent reads them.
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Each card is a real <code className="rounded bg-card/60 px-1 py-0.5 font-mono text-xs">SKILL.md</code>{" "}
                  from this repo. Copy the raw file into your project&apos;s skills directory, or
                  let the installer drop the full catalog.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/downloads"
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/70 hover:text-accent"
                >
                  <PackageCheck size={14} aria-hidden />
                  Full installer
                </Link>
                <Link
                  href="/library"
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/70 hover:text-accent"
                >
                  Browse all skills
                </Link>
              </div>
            </div>
          </Identified>

          <Identified
            as="LandingEvolutionLoopFeaturedSkillsGrid"
            className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3"
          >
            {FEATURED_SKILL_IDS.map((id) => (
              <FeaturedSkillCard key={id} skillId={id} />
            ))}
          </Identified>
        </div>
      </Identified>
    </SiteSection>
  );
}
