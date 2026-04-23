import type { ReviewState } from "@/lib/filter-store";
export type EvalReviewStatusFilterChipsProps = {
    statusFilter: "all" | ReviewState;
    onStatusChange: (value: "all" | ReviewState) => void;
    className?: string;
};
/**
 * Review-state chip row shared by playable archive and project market filter bars.
 */
export declare function EvalReviewStatusFilterChips({ statusFilter, onStatusChange, className, }: EvalReviewStatusFilterChipsProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=EvalReviewStatusFilterChips.d.ts.map