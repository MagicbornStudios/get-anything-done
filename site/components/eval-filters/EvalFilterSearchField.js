"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvalFilterSearchField = EvalFilterSearchField;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const utils_1 = require("@/lib/utils");
/**
 * Shared search row: icon + input + clear, used by home playable and project market filters.
 */
function EvalFilterSearchField({ value, onChange, placeholder = "Search…", inputClassName = "h-9 rounded-lg border-border/70 bg-background/60 py-2 pl-8 pr-8 text-xs shadow-none focus-visible:ring-accent/40", clearAriaLabel = "Clear search", wrapperClassName = "relative min-w-[180px] flex-1", }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: (0, utils_1.cn)(wrapperClassName), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { size: 13, className: "pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground", "aria-hidden": true }), (0, jsx_runtime_1.jsx)(input_1.Input, { type: "text", value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, className: inputClassName }), value ? ((0, jsx_runtime_1.jsx)(button_1.Button, { type: "button", variant: "ghost", size: "icon", onClick: () => onChange(""), className: "absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground", "aria-label": clearAriaLabel, children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "size-3", "aria-hidden": true }) })) : null] }));
}
