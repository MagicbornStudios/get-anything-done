"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayableDocModal = PlayableDocModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const dialog_1 = require("@/components/ui/dialog");
const scroll_area_1 = require("@/components/ui/scroll-area");
function PlayableDocModal({ modal, selected, onOpenChange }) {
    return ((0, jsx_runtime_1.jsx)(dialog_1.Dialog, { open: !!modal && !!selected, onOpenChange: onOpenChange, children: (0, jsx_runtime_1.jsxs)(dialog_1.DialogContent, { className: "max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0", children: [(0, jsx_runtime_1.jsxs)(dialog_1.DialogHeader, { className: "px-6 py-4 border-b border-border/60", children: [(0, jsx_runtime_1.jsxs)(dialog_1.DialogDescription, { className: "text-xs uppercase tracking-wider text-muted-foreground", children: [modal === "requirements" ? "Game requirements" : "Top skill", " \u00B7", " ", selected?.project, "/", selected?.version] }), (0, jsx_runtime_1.jsx)(dialog_1.DialogTitle, { className: "truncate text-lg", children: modal === "requirements"
                                ? selected?.requirementsDoc?.filename
                                : selected?.topSkill?.filename })] }), (0, jsx_runtime_1.jsx)(scroll_area_1.ScrollArea, { className: "flex-1 min-h-0", children: (0, jsx_runtime_1.jsx)("div", { className: "p-6", children: (0, jsx_runtime_1.jsx)("pre", { className: "whitespace-pre-wrap break-words font-mono text-xs leading-6 text-muted-foreground", children: modal === "requirements"
                                ? selected?.requirementsDoc?.content
                                : selected?.topSkill?.content ?? "(skill file content unavailable)" }) }) })] }) }));
}
