import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Props = {
  currentRequirementsVersion: string;
};

export function HeroBadges({ currentRequirementsVersion }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <Badge variant="default" className="inline-flex items-center gap-1.5">
        <Flame size={11} aria-hidden />
        requirements {currentRequirementsVersion}
      </Badge>
      <Badge variant="outline">milestone gad-v1.1</Badge>
    </div>
  );
}
