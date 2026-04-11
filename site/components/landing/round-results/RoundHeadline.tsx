import type { RoundHeadlineData } from "@/components/landing/round-results/round-results-shared";

type Props = {
  data: RoundHeadlineData;
};

/** Render a headline with the highlight portion wrapped in gradient-text */
export function RoundHeadline({ data }: Props) {
  const idx = data.headline.indexOf(data.headlineHighlight);
  if (idx < 0) return <>{data.headline}</>;
  const before = data.headline.slice(0, idx);
  const after = data.headline.slice(idx + data.headlineHighlight.length);
  return (
    <>
      {before}
      <span className="gradient-text">{data.headlineHighlight}</span>
      {after}
    </>
  );
}
