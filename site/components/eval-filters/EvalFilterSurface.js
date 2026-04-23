"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvalFilterSurface = EvalFilterSurface;
const jsx_runtime_1 = require("react/jsx-runtime");
const utils_1 = require("@/lib/utils");
/** Shared card shell for eval/playable filter rows (visual CMS band). */
function EvalFilterSurface({ children, className }) {
    return ((0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)("rounded-xl border border-border/60 bg-card/30 p-4", className), children: children }));
}
