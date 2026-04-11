import { Beaker } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IMPROVEMENTS } from "./skeptic-shared";

export default function SkepticImprovementsSection() {
  return (
    <section className="border-b border-border/60 bg-card/20">
      <div className="section-shell">
        <div className="mb-6 flex items-center gap-3">
          <Beaker size={18} className="text-emerald-400" aria-hidden />
          <p className="section-kicker !mb-0">
            What would make us more credible
          </p>
        </div>
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          Concrete moves, ranked by how much they&apos;d actually move the
          needle. The top three are doable in the next session if we choose to
          prioritize credibility over feature velocity.
        </p>
        <div className="space-y-3">
          {IMPROVEMENTS.map((imp) => (
            <Card key={imp.rank} className="border-l-4 border-emerald-500/40">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 font-mono text-sm font-semibold text-emerald-300">
                    {imp.rank}
                  </span>
                  <CardTitle className="text-base leading-tight">
                    {imp.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pl-12 text-sm leading-6 text-muted-foreground">
                {imp.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
