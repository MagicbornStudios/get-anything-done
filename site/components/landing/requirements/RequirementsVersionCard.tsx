import { Badge } from "@/components/ui/badge";
import { REQUIREMENTS_VERSION_GRADIENT } from "@/components/landing/requirements/requirements-shared";
import type { RequirementsVersion } from "@/lib/catalog.generated";

type Props = {
  version: RequirementsVersion;
};

export function RequirementsVersionCard({ version: v }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 md:p-8 ${
        REQUIREMENTS_VERSION_GRADIENT[v.version] ?? "border-border/70 from-card/40 to-transparent"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-3xl font-semibold tabular-nums">{v.version}</h3>
            <Badge variant="outline">{v.date}</Badge>
            {v.version === "v4" && <Badge variant="default">current</Badge>}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {v.sections.scope && (
          <div>
            <p className="text-xs uppercase tracking-wider text-accent">Scope</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
              {v.sections.scope}
            </p>
          </div>
        )}
        {v.sections.changes_from_v1 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-accent">Changes from v1</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
              {v.sections.changes_from_v1}
            </p>
          </div>
        )}
        {v.sections.changes_from_v2 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-accent">Changes from v2</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
              {v.sections.changes_from_v2}
            </p>
          </div>
        )}
        {v.sections.changes_from_v3 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-accent">Changes from v3</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
              {v.sections.changes_from_v3}
            </p>
          </div>
        )}
        {v.sections.core_shift_from_v3 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-accent">Core shift from v3</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
              {v.sections.core_shift_from_v3}
            </p>
          </div>
        )}
        {v.sections.problems_that_emerged && (
          <div>
            <p className="text-xs uppercase tracking-wider text-red-400">Problems that emerged</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
              {v.sections.problems_that_emerged}
            </p>
          </div>
        )}
        {v.sections.scoring_impact && (
          <div>
            <p className="text-xs uppercase tracking-wider text-accent">Scoring impact</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
              {v.sections.scoring_impact}
            </p>
          </div>
        )}
        {v.sections.brownfield_vs_greenfield && (
          <div>
            <p className="text-xs uppercase tracking-wider text-accent">Brownfield vs greenfield</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
              {v.sections.brownfield_vs_greenfield}
            </p>
          </div>
        )}
        {v.sections.decision_references && (
          <div>
            <p className="text-xs uppercase tracking-wider text-accent">Decision references</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
              {v.sections.decision_references}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
