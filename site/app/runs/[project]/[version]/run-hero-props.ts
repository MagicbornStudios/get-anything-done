import type { EvalRunRecord } from "@/lib/eval-data";

export type RunHeroBaseProps = {
  run: EvalRunRecord;
  playable: string | null;
  composite: number;
  humanScore: number | null;
  gateKnown: boolean;
  divergent: boolean;
  rateLimited: boolean;
  apiInterrupted: boolean;
  rateLimitNote: string | null;
  interruptionNote: string | null;
};
