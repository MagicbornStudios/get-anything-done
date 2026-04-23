export type EvalFilterSearchFieldProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Tailwind classes for the text input (height, padding, border, etc.) */
    inputClassName?: string;
    clearAriaLabel?: string;
    /** Optional wrapper when embedding in a flex row (default: relative min-w flex-1) */
    wrapperClassName?: string;
};
/**
 * Shared search row: icon + input + clear, used by home playable and project market filters.
 */
export declare function EvalFilterSearchField({ value, onChange, placeholder, inputClassName, clearAriaLabel, wrapperClassName, }: EvalFilterSearchFieldProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=EvalFilterSearchField.d.ts.map