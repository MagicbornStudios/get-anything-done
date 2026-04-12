import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { REQUIREMENTS_HISTORY } from "@/lib/catalog.generated";

export function RequirementsVersionHistorySection() {
  return (
    <SiteSection id="history">
      <SiteSectionHeading icon={FileText} kicker="Version history" kickerRowClassName="mb-6 gap-3" />
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
    </SiteSection>
  );
}
