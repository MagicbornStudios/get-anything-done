import { ExternalLink } from "lucide-react";
import { Identified } from "@/components/devid/Identified";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ref } from "@/components/refs/Ref";
import { FEATURE_REQUEST_STATUS_CONFIG } from "./feature-requests-status";

export type FeatureRequestRecord = {
  id: string;
  status: string;
  priority: string;
  target: string;
  url: string;
  issue_number: string | number;
  title: string;
  description: string;
  blocks?: string[];
  workaround?: string;
  submitted_on: string;
  related_decisions?: string[];
};

export function FeatureRequestCard({ req }: { req: FeatureRequestRecord }) {
  const config = FEATURE_REQUEST_STATUS_CONFIG[req.status] ?? FEATURE_REQUEST_STATUS_CONFIG.submitted;
  const Icon = config.icon;

  return (
    <Card className="border-l-4 border-rose-500/40">
      <CardHeader className="pb-3">
        <Identified as={`FeatureRequestCard-${req.id}-Header`} className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={config.variant} className="inline-flex items-center gap-1">
              <Icon size={10} aria-hidden />
              {req.status}
            </Badge>
            <Badge variant="outline">{req.priority}</Badge>
            <Badge variant="outline">{req.target}</Badge>
          </div>
          <a
            href={req.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:border-accent hover:text-accent"
          >
            #{req.issue_number}
            <ExternalLink size={9} aria-hidden />
          </a>
        </Identified>
        <CardTitle className="mt-2 text-lg leading-tight">{req.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Identified as={`FeatureRequestCard-${req.id}-Description`} tag="p" className="text-sm leading-6 text-muted-foreground">
          {req.description}
        </Identified>

        {req.blocks && req.blocks.length > 0 && (
          <Identified as={`FeatureRequestCard-${req.id}-Blocks`} className="mt-4 rounded border border-rose-500/20 bg-rose-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300">Blocks</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {req.blocks.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />
                  {b}
                </li>
              ))}
            </ul>
          </Identified>
        )}

        {req.workaround && (
          <Identified as={`FeatureRequestCard-${req.id}-Workaround`} className="mt-3 rounded border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">Workaround</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{req.workaround}</p>
          </Identified>
        )}

        <Identified as={`FeatureRequestCard-${req.id}-Footer`} className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span>Submitted: {req.submitted_on}</span>
          {req.related_decisions?.map((d) => (
            <Ref key={d} id={d} />
          ))}
        </Identified>
      </CardContent>
    </Card>
  );
}
