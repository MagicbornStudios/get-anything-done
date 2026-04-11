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
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="default">{KIND_LABELS[kind]}</Badge>
      {badges?.map((b) => (
        <Badge key={b.label} variant={b.variant ?? "outline"}>
          {b.label}
        </Badge>
      ))}
    </div>
  );
}
