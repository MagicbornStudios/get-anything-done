"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayableRunGroups = PlayableRunGroups;
const jsx_runtime_1 = require("react/jsx-runtime");
const hover_card_1 = require("@/components/ui/hover-card");
const button_1 = require("@/components/ui/button");
const RunInfoPanel_1 = require("@/components/landing/playable/RunInfoPanel");
const hypothesis_tracks_shared_1 = require("@/components/landing/hypothesis-tracks/hypothesis-tracks-shared");
const playable_shared_1 = require("@/components/landing/playable/playable-shared");
const eval_data_1 = require("@/lib/eval-data");
const utils_1 = require("@/lib/utils");
function PlayableRunGroups({ groupedRuns, selected, onSelectRun }) {
    return ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: groupedRuns.map((group) => {
            if (group.runs.length === 0)
                return null;
            return ((0, jsx_runtime_1.jsxs)("div", { className: "mt-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-2 flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-sm font-semibold text-foreground", children: group.label }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] text-muted-foreground", children: group.description }), (0, jsx_runtime_1.jsx)("span", { className: "rounded-full bg-muted/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground", children: group.runs.length })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: group.runs.map((r) => {
                            const key = (0, playable_shared_1.runKey)(r);
                            const active = selected && (0, playable_shared_1.runKey)(selected) === key;
                            const state = (0, playable_shared_1.reviewStateFor)(r);
                            const round = (0, hypothesis_tracks_shared_1.roundForRun)(r);
                            return ((0, jsx_runtime_1.jsxs)(hover_card_1.HoverCard, { openDelay: 200, closeDelay: 100, children: [(0, jsx_runtime_1.jsx)(hover_card_1.HoverCardTrigger, { asChild: true, children: (0, jsx_runtime_1.jsxs)(button_1.Button, { type: "button", variant: "ghost", onClick: () => onSelectRun(key), className: (0, utils_1.cn)("group h-auto gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-none", active
                                                ? "border-accent bg-accent text-accent-foreground shadow-md shadow-accent/20 hover:bg-accent/90 hover:text-accent-foreground"
                                                : "border-border/70 bg-card/40 text-muted-foreground hover:border-accent/60 hover:text-foreground"), children: [(0, jsx_runtime_1.jsx)("span", { className: `size-2 shrink-0 rounded-full ${playable_shared_1.REVIEW_STATE_DOT[state]}`, "aria-label": playable_shared_1.REVIEW_STATE_LABEL[state] }), (0, jsx_runtime_1.jsx)("span", { className: [
                                                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                                                        active ? "border-background/40 bg-background/20 text-accent-foreground" : playable_shared_1.WORKFLOW_TINT[r.workflow],
                                                    ].join(" "), children: eval_data_1.WORKFLOW_LABELS[r.workflow] }), (0, jsx_runtime_1.jsx)("span", { children: r.project.replace("escape-the-dungeon", "etd") }), (0, jsx_runtime_1.jsx)("span", { className: "tabular-nums", children: r.version }), round && ((0, jsx_runtime_1.jsx)("span", { className: [
                                                        "rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                                                        active
                                                            ? "border-background/30 text-accent-foreground/80"
                                                            : (0, playable_shared_1.roundColor)(round),
                                                    ].join(" "), children: round.replace("Evolution ", "E") })), r.tokenUsage?.total_tokens != null && ((0, jsx_runtime_1.jsx)("span", { className: [
                                                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                                                        active
                                                            ? "text-accent-foreground/60"
                                                            : "text-muted-foreground/60",
                                                    ].join(" "), children: (0, playable_shared_1.fmtTokensShort)(r.tokenUsage.total_tokens) }))] }) }), (0, jsx_runtime_1.jsx)(hover_card_1.HoverCardContent, { side: "bottom", align: "start", className: "w-80", children: (0, jsx_runtime_1.jsx)(RunInfoPanel_1.RunInfoPanel, { r: r }) })] }, key));
                        }) })] }, group.id));
        }) }));
}
