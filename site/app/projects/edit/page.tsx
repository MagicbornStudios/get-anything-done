import { notFound } from "next/navigation";
import Link from "next/link";
import type { EvalProjectMeta } from "@/lib/eval-data";
import { loadAllProjectMeta } from "./eval-data-runtime";

export const dynamic = "force-dynamic";

export const metadata = { title: "Project Editor — Select project" };

export default function ProjectEditIndex() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const EVAL_PROJECTS = loadAllProjectMeta();

  // Group by project slug — each project may have multiple species rows
  const byProject = new Map<string, EvalProjectMeta[]>();
  for (const p of EVAL_PROJECTS) {
    const slug = p.project ?? p.id.split("/")[0];
    const list = byProject.get(slug) ?? [];
    list.push(p);
    byProject.set(slug, list);
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
            dev mode
          </span>
          <h1 className="text-lg font-semibold">Project Editor</h1>
        </div>
        <div className="space-y-2">
          {[...byProject.entries()].map(([slug, species]) => (
            <Link
              key={slug}
              href={`/projects/edit/${slug}`}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-card/30 px-4 py-3 transition-colors hover:bg-card/50"
            >
              <div>
                <span className="text-sm font-medium">{slug}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {species.length} species
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {species[0]?.domain ?? "—"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
