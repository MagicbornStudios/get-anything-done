import Link from "next/link";
import type { AuthoredByRun } from "./skill-detail-shared";

export default function SkillDetailAuthoredByRunsCard({ runs }: { runs: AuthoredByRun[] }) {
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
      <p className="text-xs uppercase tracking-wider text-amber-300">Authored by run</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Eval runs whose preserved skill artifacts include a file matching this id.
        Provenance per <Link href="/decisions#gad-76" className="text-accent underline decoration-dotted">gad-76</Link>.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {runs.map((r) => (
          <li key={`${r.project}-${r.version}`}>
            <Link
              href={`/runs/${r.project}/${r.version}`}
              className="flex items-center justify-between gap-2 rounded border border-border/40 bg-background/40 px-2 py-1.5 font-mono text-[11px] text-foreground hover:border-accent hover:text-accent"
            >
              <span>{r.project.replace("escape-the-dungeon", "etd")}/{r.version}</span>
              {r.humanScore != null && (
                <span className="text-amber-300 tabular-nums">
                  {r.humanScore.toFixed(2)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
