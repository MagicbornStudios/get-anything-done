"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayableReviewLegend = PlayableReviewLegend;
const jsx_runtime_1 = require("react/jsx-runtime");
const playable_shared_1 = require("@/components/landing/playable/playable-shared");
function PlayableReviewLegend() {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold uppercase tracking-wider", children: "Legend:" }), (0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1.5", children: [(0, jsx_runtime_1.jsx)("span", { className: `size-2 rounded-full ${playable_shared_1.REVIEW_STATE_DOT.reviewed}`, "aria-hidden": true }), "reviewed"] }), (0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1.5", children: [(0, jsx_runtime_1.jsx)("span", { className: `size-2 rounded-full ${playable_shared_1.REVIEW_STATE_DOT["needs-review"]}`, "aria-hidden": true }), "needs review"] }), (0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1.5", children: [(0, jsx_runtime_1.jsx)("span", { className: `size-2 rounded-full ${playable_shared_1.REVIEW_STATE_DOT.excluded}`, "aria-hidden": true }), "excluded (rate-limited / api-interrupted)"] })] }));
}
