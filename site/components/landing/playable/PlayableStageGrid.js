"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayableStageGrid = PlayableStageGrid;
const jsx_runtime_1 = require("react/jsx-runtime");
const utils_1 = require("@/lib/utils");
/** Two-column layout: embed (main) + side panel — reused on home playable and project market. */
function PlayableStageGrid({ children, className }) {
    return ((0, jsx_runtime_1.jsx)("div", { className: (0, utils_1.cn)("grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start", className), children: children }));
}
