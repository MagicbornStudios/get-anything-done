import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REQUIREMENTS_HISTORY } from "@/lib/catalog.generated";

export function RequirementsVersionHistorySection() {
  return (
    <section id="history" className="border-b border-border/60">
      <div className="section-shell">
        <div className="mb-6 flex items-center gap-2">
          <FileText size={18} className="text-accent" aria-hidden />
          <p className="section-kicker !mb-0">Version history</p>
        </div>
        <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
          Every requirements version has its own entry. Each version defines a round (decision{" "}
          <Link href="/decisions#gad-72" className="text-accent underline decoration-dotted">
            gad-72
          </Link>
          ) — new requirements version = new round.
        </p>
        <div className="space-y-4">
          {REQUIREMENTS_HISTORY.slice()
            .reverse()
            .map((v) => (
              <Card key={v.version}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="font-mono">
                      {v.version}
                    </Badge>
                    <CardTitle className="text-base">{v.date}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-6 text-muted-foreground">
                    {v.rawBody}
                  </pre>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    </section>
  );
}
