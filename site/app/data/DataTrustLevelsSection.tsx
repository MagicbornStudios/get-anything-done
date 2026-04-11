import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TRUST_DESCRIPTION, TRUST_TINT } from "./data-shared";

export default function DataTrustLevelsSection() {
  return (
    <section className="border-b border-border/60 bg-card/20">
      <div className="section-shell">
        <p className="section-kicker">Trust levels explained</p>
        <div className="grid gap-3 md:grid-cols-2">
          {(["deterministic", "human", "authored", "self-report"] as const).map((t) => (
            <Card key={t}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={TRUST_TINT[t]}>{t}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs leading-5 text-muted-foreground">
                {TRUST_DESCRIPTION[t]}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
