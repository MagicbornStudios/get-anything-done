import { type EvalRunRecord } from "@/lib/eval-data";
export type PlayableRunGroup = {
    id: string;
    label: string;
    description: string;
    runs: EvalRunRecord[];
};
type Props = {
    groupedRuns: PlayableRunGroup[];
    selected: EvalRunRecord | null;
    onSelectRun: (key: string) => void;
};
export declare function PlayableRunGroups({ groupedRuns, selected, onSelectRun }: Props): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=PlayableRunGroups.d.ts.map