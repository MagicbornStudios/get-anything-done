import Link from "next/link";
import { Bug, Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Nav from "@/components/landing/nav/Nav";
import Footer from "@/components/landing/Footer";
import { BUGS, BUGS_UPDATED, type BugRecord } from "@/lib/eval-data";
import { Ref } from "@/components/refs/Ref";

export const metadata = {
  title: "Bugs — GAD",
  description:
    "Bugs observed across eval runs, tracked in data/bugs.json. Each has an origin project+version, severity, and a stable anchor.",
};

const REPO = "https://github.com/MagicbornStudios/get-anything-done";

const SEVERITY_TINT: Record<string, "danger" | "default" | "outline"> = {
  critical: "danger",
  high: "danger",
  medium: "default",
  low: "outline",
};

const STATUS_TINT: Record<string, "success" | "default" | "outline" | "danger"> = {
  fixed: "success",
  open: "danger",
  wontfix: "outline",
  "reproduced-elsewhere": "default",
};

function groupByProject(bugs: BugRecord[]) {
  const groups = new Map<string, BugRecord[]>();
  for (const b of bugs) {
    const arr = groups.get(b.project) ?? [];
    arr.push(b);
    groups.set(b.project, arr);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default function BugsPage() {
  const open = BUGS.filter((b) => b.status === "open");
  const fixed = BUGS.filter((b) => b.status === "fixed");
  const byProject = groupByProject(BUGS);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />

      <section className="border-b border-border/60">
        <div className="section-shell">
          <p className="section-kicker">Bugs</p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            Bugs observed across eval runs.{" "}
            <span className="gradient-text">Tracked in public.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            When user playtests surface a bug in a shipped eval build, it goes here. Each
            entry records origin project + version, severity, expected behavior, and the
            requirement it relates to. Bugs stick around across versions so we can track
            regressions and fixes over time.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Source:{" "}
            <code className="rounded bg-card/60 px-1 py-0.5 text-xs">data/bugs.json</code>
            {BUGS_UPDATED && (
              <>
                {" · last updated "}
                <span className="tabular-nums">{BUGS_UPDATED}</span>
              </>
            )}
            {" · "}
            <a
              href={`${REPO}/blob/main/data/bugs.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-dotted"
            >
              view on GitHub
            </a>
          </p>

          <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Stat label="Total" value={BUGS.length.toString()} />
            <Stat label="Open" value={open.length.toString()} />
            <Stat label="Fixed" value={fixed.length.toString()} />
            <Stat label="Projects affected" value={byProject.length.toString()} />
          </div>
        </div>
      </section>

      {byProject.map(([project, bugs]) => (
        <section
          key={project}
          id={`project-${project}`}
          className="border-b border-border/60 bg-card/20 last:bg-background"
        >
          <div className="section-shell">
            <div className="mb-6 flex items-center gap-3">
              <Bug size={18} className="text-accent" aria-hidden />
              <p className="section-kicker !mb-0">{project}</p>
              <Badge variant="outline">{bugs.length}</Badge>
            </div>
            <div className="space-y-4">
              {bugs.map((b) => (
                <BugCard key={b.id} bug={b} />
              ))}
            </div>
          </div>
        </section>
      ))}

      {BUGS.length === 0 && (
        <section className="border-b border-border/60">
          <div className="section-shell">
            <p className="text-muted-foreground">
              No bugs logged yet. Add entries to{" "}
              <code>data/bugs.json</code> and re-run prebuild.
            </p>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}

function BugCard({ bug }: { bug: BugRecord }) {
  return (
    <Card id={bug.id} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Ref id={`B-${bug.id}`} />
            <Badge variant={SEVERITY_TINT[bug.severity] ?? "outline"}>
              {bug.severity}
            </Badge>
            <Badge variant={STATUS_TINT[bug.status] ?? "outline"}>{bug.status}</Badge>
            <span className="font-mono text-[10px] text-muted-foreground">
              {bug.version} · {bug.observed_on}
            </span>
          </div>
          <Link
            href={`#${bug.id}`}
            className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-accent hover:text-accent"
          >
            #{bug.id}
          </Link>
        </div>
        <CardTitle className="mt-2 text-base leading-tight">{bug.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
        <p>{bug.description}</p>

        <div className="mt-3 rounded border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            Expected
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{bug.expected}</p>
        </div>

        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Reproduction
          </p>
          <p className="mt-1 text-xs leading-5">{bug.reproduction}</p>
        </div>

        {(bug.related_requirement || (bug.related_runs && bug.related_runs.length > 0)) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3 text-[10px] text-muted-foreground">
            {bug.related_requirement && (
              <>
                <span className="uppercase tracking-wider">requirement:</span>
                <Ref id={bug.related_requirement} />
              </>
            )}
            {bug.related_runs && bug.related_runs.length > 0 && (
              <>
                <span className="ml-2 uppercase tracking-wider">also in:</span>
                {bug.related_runs.map((r, i) => (
                  <Link
                    key={`${r.project}-${r.version}-${i}`}
                    href={`/runs/${r.project}/${r.version}`}
                    className="inline-flex items-center rounded border border-border/60 px-1.5 py-0.5 font-mono hover:border-accent hover:text-accent"
                  >
                    {r.project.replace("escape-the-dungeon", "etd")}/{r.version}
                  </Link>
                ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
