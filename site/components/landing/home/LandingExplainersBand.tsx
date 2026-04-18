import Link from "next/link";
import { Download, ExternalLink, PlayCircle } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { SiteSection, SiteSectionIntro } from "@/components/site";
import VideoEmbed from "@/components/video/VideoEmbed";
import { getComposition } from "@/remotion/registry";
import { SKILLS, GITHUB_REPO, type CatalogSkill } from "@/lib/catalog.generated";

const GITHUB_BLOB_PREFIX = `${GITHUB_REPO}/blob/main/`;
const GITHUB_RAW_PREFIX =
  GITHUB_REPO.replace("github.com", "raw.githubusercontent.com") + "/main/";

type ExplainerEntry = {
  key: string;
  compositionSlug: string;
  kicker: string;
  title: React.ReactNode;
  summary: string;
  skillIds: string[];
  footnote: string;
};

const EXPLAINERS: ExplainerEntry[] = [
  {
    key: "vcs",
    compositionSlug: "vcs-explainer",
    kicker: "Explainer · 30s",
    title: (
      <>
        Visual context <span className="gradient-text">anywhere</span>.
      </>
    ),
    summary:
      "Source-searchable identifiers (cid / as), two landmark primitives (SiteSection, Identified), and the four-skill stack that drops this pattern into any GUI project — React, Next, Unity, Blender, whatever has a DOM or a tree.",
    skillIds: [
      "gad-visual-context-system",
      "gad-visual-context-panel-identities",
      "scaffold-visual-context-surface",
      "portfolio-sync",
    ],
    footnote:
      "Install the four skills, let the agent rewire your surfaces, then grep any pixel back to source.",
  },
  {
    key: "evolution",
    compositionSlug: "gad-evolution-explainer",
    kicker: "Explainer · 30s",
    title: (
      <>
        Skills <span className="gradient-text">born from pressure</span>.
      </>
    ),
    summary:
      "The get-anything-done framework is evolutionary. The Pressure v3 formula (gad-222) names candidates, the five-step loop turns each into a proto-skill, and species.json tracks what the next generation still needs vs what gets shed.",
    skillIds: [
      "create-proto-skill",
      "gad-evolution-evolve",
      "gad-evolution-validator",
      "gad-proto-skill-battery",
      "find-skills",
      "merge-skill",
    ],
    footnote:
      "Every skill on this site was born this way — then audited, equipped, or shed by the next agent that cleared the threshold.",
  },
];

function githubLinksFor(skill: CatalogSkill) {
  // skill.file is repo-relative (e.g. "skills/foo/SKILL.md" or "vendor/get-anything-done/skills/...").
  // Normalize to the path used in the public repo, which is "skills/..." without the vendor prefix.
  const normalized = skill.file.replace(/^vendor\/get-anything-done\//, "");
  return {
    path: normalized,
    viewHref: `${GITHUB_BLOB_PREFIX}${normalized}`,
    downloadHref: `${GITHUB_RAW_PREFIX}${normalized}`,
  };
}

function ExplainerCard({ entry }: { entry: ExplainerEntry }) {
  const composition = getComposition(entry.compositionSlug);
  const skills = entry.skillIds
    .map((id) => SKILLS.find((s) => s.id === id))
    .filter((s): s is CatalogSkill => Boolean(s));

  return (
    <Identified
      as={`LandingExplainer-${entry.key}`}
      className="flex min-w-0 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/15 px-4 py-2.5">
          <PlayCircle size={14} aria-hidden className="text-accent" />
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {entry.kicker}
          </p>
          {composition ? (
            <span className="ml-auto font-mono text-[11px] text-muted-foreground/70">
              {composition.slug}
            </span>
          ) : null}
        </div>

        <div className="bg-background/60 p-4 md:p-5">
          {composition ? (
            <VideoEmbed composition={composition} />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 p-6 text-sm text-muted-foreground">
              Composition <code className="mx-1 rounded bg-card/60 px-1 font-mono text-xs">{entry.compositionSlug}</code>{" "}
              not found in registry.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 px-5 pb-5 md:px-6 md:pb-6">
          <h3 className="text-2xl font-semibold leading-tight text-foreground md:text-3xl">
            {entry.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
            {entry.summary}
          </p>

          <div>
            <p className="section-kicker !mb-2">Skills you install to get this</p>
            <ul className="flex flex-col gap-2">
              {skills.map((skill) => {
                const { path, viewHref, downloadHref } = githubLinksFor(skill);
                return (
                  <li
                    key={skill.id}
                    className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/50 bg-background/50 px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="font-mono text-sm text-foreground">
                        {skill.id}
                      </span>
                      <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {skill.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={viewHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`View ${path} on GitHub`}
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent"
                      >
                        <ExternalLink size={11} aria-hidden />
                        View
                      </Link>
                      <a
                        href={downloadHref}
                        download
                        title={`Download raw ${path}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-accent/70 hover:text-accent"
                      >
                        <Download size={11} aria-hidden />
                        SKILL.md
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="border-l-2 border-accent/50 pl-3 text-xs italic leading-relaxed text-foreground/80">
            {entry.footnote}
          </p>
        </div>
      </div>
    </Identified>
  );
}

/**
 * Home band that hosts the two 30s Remotion explainers:
 *   1. Visual Context System — the pattern + the four skills that install it anywhere.
 *   2. GAD Evolution Loop    — why the framework is evolutionary and how skills are born.
 *
 * Each card pairs the playable video with the concrete skill files the viewer
 * needs to actually reproduce the subject in their own repo. Raw SKILL.md
 * download links point at the public GitHub main branch.
 */
export function LandingExplainersBand() {
  return (
    <SiteSection
      id="explainers"
      cid="explainers-site-section"
      className="border-t border-border/60 bg-gradient-to-b from-background via-muted/[0.04] to-background"
    >
      <Identified as="LandingExplainersBand">
        <SiteSectionIntro
          kicker="Watch the two explainers"
          preset="hero-compact"
          title={
            <>
              Two 30-second <span className="gradient-text">explainers</span>. Two
              directly-downloadable skill stacks.
            </>
          }
          proseSize="md"
          proseClassName="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
        >
          The left video names the Visual Context System pattern and the skills
          that install it into any GUI. The right video names the evolutionary
          framework that turns high-pressure phases into new skills. Every skill
          under each video is a real <code className="rounded bg-card/60 px-1 font-mono text-xs">SKILL.md</code>{" "}
          on GitHub — one click to view, one click to download.
        </SiteSectionIntro>

        <Identified
          as="LandingExplainersGrid"
          className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8"
        >
          {EXPLAINERS.map((entry) => (
            <ExplainerCard key={entry.key} entry={entry} />
          ))}
        </Identified>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link
            href="/videos"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-4 py-2 font-medium text-foreground transition-colors hover:border-accent/70 hover:text-accent"
          >
            <PlayCircle size={14} aria-hidden />
            All explainers
          </Link>
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-4 py-2 font-medium text-foreground transition-colors hover:border-accent/70 hover:text-accent"
          >
            Browse all skills
          </Link>
          <Link
            href="/downloads"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-4 py-2 font-medium text-foreground transition-colors hover:border-accent/70 hover:text-accent"
          >
            <Download size={14} aria-hidden />
            Full installer
          </Link>
        </div>
      </Identified>
    </SiteSection>
  );
}
