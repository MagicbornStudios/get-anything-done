import { METHODOLOGY_TEMPLATE_ROWS } from "@/app/methodology/methodology-shared";
import { SiteProse, SiteSection } from "@/components/site";

export function MethodologyTemplateMatrixSection() {
  return (
    <SiteSection>
      <p className="section-kicker">What each condition template contains</p>
      <SiteProse size="sm" className="mb-6">
        {`Transparency about what the eval agent receives. Each column is one condition. \u2713 means the file is present in the template; \u2014 means absent. This is the full input set \u2014 the agent sees nothing else.`}
      </SiteProse>
      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card/40">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/60 bg-card/60">
            <tr>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                File
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                Bare
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
                Planning
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                GAD
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Emergent
              </th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-pink-300">
                GAD+Emrg
              </th>
            </tr>
          </thead>
          <tbody className="text-xs text-muted-foreground">
            {METHODOLOGY_TEMPLATE_ROWS.map(([file, ...vals], i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-transparent" : "bg-background/30"}>
                <td className="px-3 py-2 font-mono text-foreground/80">{file}</td>
                {vals.map((v, j) => (
                  <td
                    key={j}
                    className={`px-3 py-2 text-center ${
                      v === "\u2713"
                        ? "text-emerald-400"
                        : v === "\u2014"
                          ? "text-muted-foreground/40"
                          : "font-semibold text-foreground"
                    }`}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">
        Source: the <code className="rounded bg-background/60 px-1 py-0.5">template/</code> directory of
        each eval project under{" "}
        <code className="rounded bg-background/60 px-1 py-0.5">evals/escape-the-dungeon*/</code>. This
        table shows the greenfield setup. Brownfield conditions additionally receive the preserved
        source code from their baseline greenfield run.
      </p>
    </SiteSection>
  );
}
