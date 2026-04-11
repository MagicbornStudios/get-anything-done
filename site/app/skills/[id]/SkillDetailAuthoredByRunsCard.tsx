import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AuthoredByRun } from "./skill-detail-shared";

export default function SkillDetailAuthoredByRunsCard({ runs }: { runs: AuthoredByRun[] }) {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5 shadow-none">
      <CardContent className="space-y-3 p-5">
        <p className="text-xs uppercase tracking-wider text-amber-300">Authored by run</p>
        <p className="text-xs text-muted-foreground">
          Eval runs whose preserved skill artifacts include a file matching this id. Provenance per{" "}
          <Link href="/decisions#gad-76" className="text-accent underline decoration-dotted">
            gad-76
          </Link>
          .
        </p>
        <ul className="space-y-2 text-sm">
          {runs.map((r) => (
            <li key={`${r.project}-${r.version}`}>
              <Button
                variant="outline"
                className="h-auto w-full justify-between gap-2 rounded border-border/40 bg-background/40 px-2 py-1.5 font-mono text-[11px] font-normal text-foreground hover:border-accent hover:text-accent"
                asChild
              >
                <Link href={`/runs/${r.project}/${r.version}`}>
                  <span>{r.project.replace("escape-the-dungeon", "etd")}/{r.version}</span>
                  {r.humanScore != null && (
                    <span className="text-amber-300 tabular-nums">{r.humanScore.toFixed(2)}</span>
                  )}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
