import { HeroStat } from "@/components/landing/hero/HeroStat";

type Props = {
  playableCount: number;
  runsScored: number;
  decisionsLogged: number;
  currentRequirementsVersion: string;
};

export function HeroStatsGrid({
  playableCount,
  runsScored,
  decisionsLogged,
  currentRequirementsVersion,
}: Props) {
  return (
    <dl className="mt-14 grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-4">
      <HeroStat label="Playable runs" value={playableCount.toString()} />
      <HeroStat label="Runs scored" value={runsScored.toString()} />
      <HeroStat label="Decisions logged" value={decisionsLogged.toString()} />
      <HeroStat label="Requirements" value={currentRequirementsVersion} />
    </dl>
  );
}
