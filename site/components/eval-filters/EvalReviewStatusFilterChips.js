"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvalReviewStatusFilterChips = EvalReviewStatusFilterChips;
const jsx_runtime_1 = require("react/jsx-runtime");
const button_1 = require("@/components/ui/button");
const utils_1 = require("@/lib/utils");
const playable_shared_1 = require("@/components/landing/playable/playable-shared");
const STATUSES = ["all", "reviewed", "needs-review", "excluded"];
/**
 * Review-state chip row shared by playable archive and project market filter bars.
 */
function EvalReviewStatusFilterChips({ statusFilter, onStatusChange, className, }) {
    return ((0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)("flex flex-wrap items-center gap-1.5", className), children: STATUSES.map((s) => {
            const isActive = statusFilter === s;
            const styles = playable_shared_1.STATUS_CHIP_STYLES[s];
            return ((0, jsx_runtime_1.jsxs)(button_1.Button, { type: "button", variant: "ghost", size: "sm", onClick: () => onStatusChange(s), className: (0, utils_1.cn)("h-auto gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-none", isActive ? styles.active : styles.base), children: [s !== "all" ? ((0, jsx_runtime_1.jsx)("span", { className: `size-1.5 rounded-full ${playable_shared_1.REVIEW_STATE_DOT[s]}`, "aria-hidden": true })) : null, s === "all" ? "All statuses" : playable_shared_1.REVIEW_STATE_LABEL[s]] }, s));
        }) }));
}
