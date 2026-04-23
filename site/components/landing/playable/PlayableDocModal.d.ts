import type { EvalRunRecord } from "@/lib/eval-data";
type Props = {
    modal: "requirements" | "skill" | null;
    selected: EvalRunRecord | null;
    onOpenChange: (open: boolean) => void;
};
export declare function PlayableDocModal({ modal, selected, onOpenChange }: Props): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=PlayableDocModal.d.ts.map