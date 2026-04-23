import { Identified } from "@portfolio/visual-context";
import { Badge } from "@/components/ui/badge";
import type { DetailShellProps } from "./detail-shell-shared";
import { KIND_LABELS } from "./detail-shell-shared";

export default function DetailShellKindBadges({
  kind,
  badges,
}: {
  kind: DetailShellProps["kind"];
  badges?: DetailShellProps["badges"];
}) {
  return (
    <Identified as="DetailShellKindBadges" className="flex flex-wrap items-center gap-3">
      <Identified as={`DetailShellKindBadge-${kind}`}>
        <Badge variant="default">{KIND_LABELS[kind]}</Badge>
      </Identified>
      {badges?.map((b) => (
        <Identified key={b.label} as={`DetailShellExtraBadge-${b.label.replace(/[^a-zA-Z0-9]+/g, "-")}`}>
          <Badge variant={b.variant ?? "outline"}>{b.label}</Badge>
        </Identified>
      ))}
    </Identified>
  );
}
