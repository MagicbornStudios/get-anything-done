import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  activeRound: string;
  onClear: () => void;
};

export function HypothesisTracksActiveRoundBar({ activeRound, onClear }: Props) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <Badge
        variant="outline"
        className="border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-semibold normal-case tracking-normal text-purple-300"
      >
        Filtering: {activeRound}
      </Badge>
      <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={onClear}>
        Clear filter
      </Button>
    </div>
  );
}
