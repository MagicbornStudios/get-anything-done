export const dynamic = "force-dynamic";

import {
  ArrowRight,
  BookOpen,
  Brain,
  ChevronRight,
  Dna,
  ExternalLink,
  GitBranch,
  Layers,
  RotateCcw,
  Target,
  TreePine,
  Trophy,
  Users,
} from "lucide-react";
import {
  MarketingShell,
  SiteProse,
  SiteSection,
  SiteSectionHeading,
} from "@/components/site";

export const metadata = {
  title: "How It Works — GAD",
  description:
    "The GAD methodology: structured planning loops, species/generation model, and reproducible scoring.",
};

/* ------------------------------------------------------------------ */
/*  Reusable bits                                                      */
/* ------------------------------------------------------------------ */

function StepCircle({ n }: { n: number }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent bg-accent/10 text-sm font-bold text-accent">
      {n}
    </div>
  );
}

function StepArrow() {
  return (
    <ChevronRight
      size={20}
      className="hidden shrink-0 text-muted-foreground/40 md:block"
      aria-hidden
    />
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-card p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-base font-semibold text-foreground">{children}</h3>;
}

function CardBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm leading-6 text-muted-foreground">{children}</div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HowItWorksPage() {
  return (
    <MarketingShell>
      {/* ---- Hero ---- */}
      <SiteSection cid="how-it-works-hero">
        <div className="mx-auto max-w-4xl space-y-6 py-12">
          <SiteSectionHeading
            kicker="Methodology"
            as="h1"
            preset="hero"
            title={
              <>
                How GAD works.{" "}
                <span className="text-muted-foreground">
                  Loop, evolve, measure.
                </span>
              </>
            }
          />
          <SiteProse>
            GAD gives AI coding agents a durable planning layer so
            conversation history can be thrown away, compacted, or handed to a
            different agent without losing state. The framework is four ideas:
            a deterministic work loop, an evolutionary model for builds, a
            scoring system, and a small set of standards everything else
            inherits from.
          </SiteProse>
        </div>
      </SiteSection>

      {/* ---- Section 1: The GAD Loop ---- */}
      <SiteSection cid="how-it-works-loop" tone="muted">
        <div className="mx-auto max-w-4xl space-y-8 py-12">
          <SiteSectionHeading
            icon={RotateCcw}
            kicker="Section 1"
            title="The GAD Loop"
            preset="section"
          />
          <SiteProse>
            Every task follows the same five-step cycle. The loop is the atomic
            unit of work — one iteration produces one committed change with
            updated planning docs.
          </SiteProse>

          {/* Step diagram */}
          <div
            data-cid="loop-step-diagram"
            className="flex flex-col items-start gap-4 md:flex-row md:items-center md:gap-3"
          >
            {[
              { n: 1, label: "gad snapshot", sub: "Load full context" },
              { n: 2, label: "Pick task", sub: "status=planned" },
              { n: 3, label: "Implement", sub: "Write code" },
              { n: 4, label: "Update docs", sub: "STATE + TASKS" },
              { n: 5, label: "Commit", sub: "Atomic change" },
            ].map((step, i) => (
              <div key={step.n} className="flex items-center gap-3">
                {i > 0 && <StepArrow />}
                <div className="flex items-center gap-3">
                  <StepCircle n={step.n} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.sub}</p>
                  </div>
                </div>
              </div>
            ))}
            {/* Loop-back arrow */}
            <div className="hidden items-center gap-2 text-muted-foreground/40 md:flex">
              <ArrowRight size={16} aria-hidden />
              <span className="text-xs italic">repeat</span>
            </div>
          </div>

          {/* What snapshot gives you */}
          <Card>
            <CardTitle>What gad snapshot delivers</CardTitle>
            <CardBody>
              <p className="mb-3">
                One command loads everything the agent needs to orient:
              </p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { icon: Target, text: "Current state and next-action" },
                  { icon: Layers, text: "Task registry with statuses" },
                  { icon: GitBranch, text: "Roadmap phases and milestones" },
                  { icon: BookOpen, text: "Decision log (GAD-D-NNN)" },
                  { icon: Brain, text: "Skill catalog with triggers" },
                  { icon: Users, text: "Agent attribution map" },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-2">
                    <item.icon
                      size={14}
                      className="mt-0.5 shrink-0 text-accent"
                      aria-hidden
                    />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="border-accent/30 bg-accent/5">
            <CardBody>
              <p className="font-medium text-foreground">Key insight:</p>
              <p className="mt-1">
                Planning docs are the durable state, not conversation history.
                An agent can be swapped, compacted, or restarted — as long as
                the XML files are current, gad snapshot rehydrates full
                context in one call.
              </p>
            </CardBody>
          </Card>
        </div>
      </SiteSection>

      {/* ---- Section 2: Species, Generations & DNA ---- */}
      <SiteSection cid="how-it-works-evolution">
        <div className="mx-auto max-w-4xl space-y-8 py-12">
          <SiteSectionHeading
            icon={Dna}
            kicker="Section 2"
            title="Species, Generations & DNA"
            preset="section"
          />
          <SiteProse>
            GAD models AI builds as an evolutionary system. A project defines
            what to build. A species defines how. Generations are the actual
            builds, each inheriting from the last.
          </SiteProse>

          {/* Concept cards */}
          <div
            data-cid="evolution-concept-grid"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Target size={16} className="text-accent" aria-hidden />
                <CardTitle>Project</CardTitle>
              </div>
              <CardBody>
                The thing being built — requirements, goals, domain
                constraints. A project is stable; what changes is how you
                build it.
              </CardBody>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <TreePine size={16} className="text-accent" aria-hidden />
                <CardTitle>Species</CardTitle>
              </div>
              <CardBody>
                A transferable configuration bundle: tech stack + skills +
                context framework. Like a recipe for how to build. Can be
                shared between projects, imported like a trading card.
              </CardBody>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Layers size={16} className="text-accent" aria-hidden />
                <CardTitle>Generation</CardTitle>
              </div>
              <CardBody>
                An actual build produced by running a species against a
                project's requirements. Each generation builds on the last
                (brownfield), so improvements compound.
              </CardBody>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Dna size={16} className="text-accent" aria-hidden />
                <CardTitle>DNA</CardTitle>
              </div>
              <CardBody>
                The skill + workflow + constraint combination that defines a
                species. Two species with the same DNA produce equivalent
                builds given the same project.
              </CardBody>
            </Card>
          </div>

          {/* Tree diagram */}
          <Card>
            <CardTitle>Evolutionary tree</CardTitle>
            <CardBody>
              <div className="mt-3 font-mono text-xs leading-6 text-muted-foreground">
                <p>
                  <span className="text-foreground font-semibold">Project</span>{" "}
                  (requirements + goals)
                </p>
                <p>
                  &nbsp;&nbsp;
                  <span className="text-accent">|</span>
                </p>
                <p>
                  &nbsp;&nbsp;
                  <span className="text-accent">+--</span>{" "}
                  <span className="text-foreground">Species A</span>{" "}
                  <span className="text-muted-foreground/60">
                    (kaplay + gad + combat-skills)
                  </span>
                </p>
                <p>
                  &nbsp;&nbsp;
                  <span className="text-accent">|</span>
                  &nbsp;&nbsp;&nbsp;
                  <span className="text-accent">+--</span> Gen 1{" "}
                  <span className="text-muted-foreground/60">greenfield</span>
                </p>
                <p>
                  &nbsp;&nbsp;
                  <span className="text-accent">|</span>
                  &nbsp;&nbsp;&nbsp;
                  <span className="text-accent">+--</span> Gen 2{" "}
                  <span className="text-muted-foreground/60">
                    brownfield from Gen 1
                  </span>
                </p>
                <p>
                  &nbsp;&nbsp;
                  <span className="text-accent">|</span>
                  &nbsp;&nbsp;&nbsp;
                  <span className="text-accent">+--</span> Gen 3{" "}
                  <span className="text-muted-foreground/60">
                    brownfield from Gen 2
                  </span>
                </p>
                <p>
                  &nbsp;&nbsp;
                  <span className="text-accent">|</span>
                </p>
                <p>
                  &nbsp;&nbsp;
                  <span className="text-accent">+--</span>{" "}
                  <span className="text-foreground">Species B</span>{" "}
                  <span className="text-muted-foreground/60">
                    (phaser + bare + no-skills)
                  </span>
                </p>
                <p>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                  <span className="text-accent">+--</span> Gen 1{" "}
                  <span className="text-muted-foreground/60">greenfield</span>
                </p>
                <p>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                  <span className="text-accent">+--</span> Gen 2{" "}
                  <span className="text-muted-foreground/60">
                    brownfield from Gen 1
                  </span>
                </p>
              </div>
            </CardBody>
          </Card>

          <Card className="border-accent/30 bg-accent/5">
            <CardBody>
              <p className="font-medium text-foreground">Key insight:</p>
              <p className="mt-1">
                Species are trading cards. Import someone else's species into
                your project, combine it with your requirements, and produce a
                new generation. The evolutionary model makes AI builds
                composable and comparable.
              </p>
            </CardBody>
          </Card>
        </div>
      </SiteSection>

      {/* ---- Section 3: Scoring & Measurement ---- */}
      <SiteSection cid="how-it-works-scoring" tone="muted">
        <div className="mx-auto max-w-4xl space-y-8 py-12">
          <SiteSectionHeading
            icon={Trophy}
            kicker="Section 3"
            title="Scoring & Measurement"
            preset="section"
          />
          <SiteProse>
            Every generation gets a composite score built from weighted
            dimensions. The weights are per-project (configured in
            species.json), so different domains can emphasize what matters to
            them.
          </SiteProse>

          {/* Scoring dimensions */}
          <div data-cid="scoring-dimensions" className="space-y-3">
            {[
              {
                dim: "Requirement Coverage",
                weight: "20%",
                desc: "How many spec requirements does the build satisfy?",
              },
              {
                dim: "Implementation Quality",
                weight: "15%",
                desc: "Code structure, error handling, type safety, conventions.",
              },
              {
                dim: "Workflow Emergence",
                weight: "10%",
                desc: "Did the agent develop its own effective patterns?",
              },
              {
                dim: "Iteration Evidence",
                weight: "10%",
                desc: "Commits, planning updates, brownfield improvement over prior gen.",
              },
              {
                dim: "Time Efficiency",
                weight: "15%",
                desc: "Wall-clock and token cost relative to output quality.",
              },
              {
                dim: "Human Review",
                weight: "30%",
                desc: "A human plays it, reads it, uses it. No score is final without this.",
              },
            ].map((row) => (
              <div
                key={row.dim}
                className="flex items-start gap-4 rounded-lg border border-border bg-card p-4"
              >
                <span className="shrink-0 rounded bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
                  {row.weight}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {row.dim}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Card className="border-accent/30 bg-accent/5">
            <CardBody>
              <p className="font-medium text-foreground">Key insight:</p>
              <p className="mt-1">
                We measure whether structured workflows actually beat
                unstructured ones — with reproducible benchmarks, not vibes.
                Species A (gad workflow) vs Species B (bare) on the same
                project, same requirements, scored on the same dimensions.
                That is the experiment.
              </p>
            </CardBody>
          </Card>
        </div>
      </SiteSection>

      {/* ---- Section 4: Standards & References ---- */}
      <SiteSection cid="how-it-works-standards">
        <div className="mx-auto max-w-4xl space-y-8 py-12">
          <SiteSectionHeading
            icon={BookOpen}
            kicker="Section 4"
            title="Standards & References"
            preset="section"
          />
          <SiteProse>
            GAD inherits from and builds on these foundations.
          </SiteProse>

          <div
            data-cid="standards-list"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <Card>
              <CardTitle>Anthropic Agent Guide</CardTitle>
              <CardBody>
                <p>
                  The{" "}
                  <a
                    href="https://www.anthropic.com/engineering/building-effective-agents"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent underline underline-offset-2 hover:text-accent/80"
                  >
                    Complete Guide to Building AI Agents
                    <ExternalLink size={12} aria-hidden />
                  </a>{" "}
                  defines augmented LLM patterns, orchestration loops, and
                  tool-use conventions. GAD's loop is a direct implementation
                  of the "agents" pattern from this guide.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardTitle>agentskills.io</CardTitle>
              <CardBody>
                <p>
                  The{" "}
                  <a
                    href="https://agentskills.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent underline underline-offset-2 hover:text-accent/80"
                  >
                    skill shape specification
                    <ExternalLink size={12} aria-hidden />
                  </a>{" "}
                  defines how portable agent skills are structured — trigger
                  conditions, workflow steps, and metadata. GAD skills follow
                  this shape.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardTitle>GAD Conventions</CardTitle>
              <CardBody>
                <p>
                  Planning XML (STATE.xml, ROADMAP.xml, TASK-REGISTRY.xml,
                  DECISIONS.xml), the snapshot protocol, skill shape with
                  trigger/workflow/metadata, and the five-doc loop that keeps
                  agent state durable across sessions.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardTitle>Source Code</CardTitle>
              <CardBody>
                <p>
                  The framework is open source.{" "}
                  <a
                    href="https://github.com/bgarraud/get-anything-done"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent underline underline-offset-2 hover:text-accent/80"
                  >
                    GitHub repository
                    <ExternalLink size={12} aria-hidden />
                  </a>{" "}
                  — CLI, skills, eval harness, and this site.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </SiteSection>
    </MarketingShell>
  );
}
