import Link from "next/link";
import { ArrowRight, Bot, FileText, Gauge, Package, Sparkles, Terminal, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import {
  AGENTS,
  COMMANDS,
  GITHUB_REPO,
  SKILLS,
  SKILL_INHERITANCE,
  TEMPLATES,
} from "@/lib/catalog.generated";

export const metadata = {
  title: "GAD framework — overview + catalog",
  description:
    "The get-anything-done framework at a glance: what it is, how the loop works, every skill, every subagent, every command, every template. The canonical entry point to exploring the framework.",
};

const CORE_CONCEPTS = [
  {
    icon: Sparkles,
    title: "Skills",
    count: SKILLS.length,
    description:
      "Methodology docs the agent follows. Each skill describes a trigger (when to use it), a pattern (what to do), a rationale (why), failure modes, and related skills. Skills are the durable memory of an agent that has no other framework.",
    href: "/#catalog",
    chip: "→ browse skills",
  },
  {
    icon: Bot,
    title: "Subagents",
    count: AGENTS.length,
    description:
      "Specialised workers the framework spawns for planning, research, verification, UI audits, and more. Subagents receive a task + context and return a concrete artifact (PLAN.md, RESEARCH.md, VERIFICATION.md). They let the main agent delegate expensive work off the critical path.",
    href: "/#catalog",
    chip: "→ browse subagents",
  },
  {
    icon: Wrench,
    title: "Commands",
    count: COMMANDS.length,
    description:
      "Slash-command entry points. Each command declares a spawned subagent (if any), an argument hint, and the methodology doc that guides the invocation. This is how humans (and other agents) reach into the framework.",
    href: "/#catalog",
    chip: "→ browse commands",
  },
  {
    icon: Package,
    title: "Templates",
    count: TEMPLATES.length,
    description:
      "The planning-doc scaffolding the CLI uses to bootstrap new projects. REQUIREMENTS, ROADMAP, STATE, TASK-REGISTRY, phase prompts, codebase docs — the raw scaffold every GAD project starts from.",
    href: "/#templates",
    chip: "→ download pack",
  },
];

export default function GADOverviewPage() {
  // Bootstrap set — skills that are inherited into at least one eval template.
  const bootstrapSkills = SKILLS.filter((s) => (SKILL_INHERITANCE[s.id] ?? []).length > 0);
  const frameworkOnlySkills = SKILLS.filter(
    (s) => (SKILL_INHERITANCE[s.id] ?? []).length === 0
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">The framework</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            <span className="text-foreground">GAD is</span>{" "}
            <span className="gradient-text">planning + evaluation</span>{" "}
            <span className="text-foreground">for AI coding agents.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            A small CLI, a strict five-step loop, and an experiment harness stapled to the side.
            The CLI re-hydrates context in one command. Skills tell the agent <em>what</em> to do.
            Subagents do the expensive work off the main thread. Commands are the slash entry
            points. Templates scaffold new projects. Evals measure whether any of this actually
            helps. Read the{" "}
            <Link href="/#workflow" className="text-accent hover:underline">
              loop diagram
            </Link>{" "}
            for how it fits together.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:-translate-y-0.5"
            >
              <Terminal size={16} aria-hidden />
              Source on GitHub
            </a>
            <Link
              href="/methodology"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <Gauge size={16} aria-hidden />
              How we score
            </Link>
            <Link
              href="/planning"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <FileText size={16} aria-hidden />
              Current planning state
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <p className="section-kicker">Core concepts</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Four moving parts
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {CORE_CONCEPTS.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.title} className="group">
                  <CardHeader>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="inline-flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/40 text-accent">
                        <Icon size={20} aria-hidden />
                      </div>
                      <Badge variant="outline" className="tabular-nums">
                        {c.count}
                      </Badge>
                    </div>
                    <CardTitle>{c.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base leading-7">
                      {c.description}
                    </CardDescription>
                    <Link
                      href={c.href}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                    >
                      {c.chip}
                      <ArrowRight size={12} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Skill bootstrap sets</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Framework-level vs eval-inherited
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            All {SKILLS.length} skills are available to the main GAD agent via slash commands.
            But eval projects (bare, emergent) don&apos;t get the full framework — they start with
            a minimal bootstrap set copied into their{" "}
            <code className="rounded bg-card/60 px-1.5 py-0.5 text-xs">template/skills/</code>{" "}
            directory. The rest of the framework isn&apos;t available to them by design — we want
            to see what they build without it.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                  bootstrap
                </Badge>
                <h3 className="text-lg font-semibold text-foreground">
                  Inherited by bare + emergent ({bootstrapSkills.length})
                </h3>
              </div>
              <div className="space-y-2">
                {bootstrapSkills.map((s) => (
                  <Link
                    key={s.id}
                    href={`/skills/${s.id}`}
                    className="block rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 transition-colors hover:border-emerald-500/60"
                  >
                    <code className="text-sm font-mono text-accent">{s.name}</code>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {s.description}
                    </p>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-emerald-400">
                      inherited by: {(SKILL_INHERITANCE[s.id] ?? []).join(", ")}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2">
                <Badge variant="outline">framework-only</Badge>
                <h3 className="text-lg font-semibold text-foreground">
                  Available to GAD runs only ({frameworkOnlySkills.length})
                </h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {frameworkOnlySkills.map((s) => (
                  <Link
                    key={s.id}
                    href={`/skills/${s.id}`}
                    className="block rounded-lg border border-border/60 bg-card/40 p-3 transition-colors hover:border-accent/60"
                  >
                    <code className="text-[11px] font-mono text-accent">{s.name}</code>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-card/20">
        <div className="section-shell">
          <p className="section-kicker">Jump to</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Explore the catalog
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Skills", count: SKILLS.length, href: "/#catalog", icon: Sparkles },
              { label: "Subagents", count: AGENTS.length, href: "/#catalog", icon: Bot },
              { label: "Commands", count: COMMANDS.length, href: "/#catalog", icon: Wrench },
              { label: "Templates", count: TEMPLATES.length, href: "/#templates", icon: Package },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group rounded-2xl border border-border/70 bg-card/40 p-6 transition-colors hover:border-accent/60"
                >
                  <Icon size={20} className="mb-3 text-accent" aria-hidden />
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {item.count}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                    Explore
                    <ArrowRight size={11} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
