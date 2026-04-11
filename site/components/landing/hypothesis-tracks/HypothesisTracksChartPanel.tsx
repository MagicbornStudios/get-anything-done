import { HypothesisTracksChart, type HypothesisTrackPoint } from "@/components/charts/HypothesisTracksChart";

type Props = {
  data: HypothesisTrackPoint[];
  onRoundClick: (round: string) => void;
  activeRound: string | null;
};

export function HypothesisTracksChartPanel({ data, onRoundClick, activeRound }: Props) {
  return (
    <div className="mt-6">
      <HypothesisTracksChart data={data} onRoundClick={onRoundClick} activeRound={activeRound} />
    </div>
  );
}
