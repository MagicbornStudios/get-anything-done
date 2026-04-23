"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayableEmbed = PlayableEmbed;
const jsx_runtime_1 = require("react/jsx-runtime");
const Identified_1 = require("@/components/devid/Identified");
const lucide_react_1 = require("lucide-react");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
function PlayableEmbed({ project, version, iframeSrc }) {
    return ((0, jsx_runtime_1.jsx)(Identified_1.Identified, { as: "PlayableEmbed", children: (0, jsx_runtime_1.jsxs)(card_1.Card, { className: "overflow-hidden rounded-2xl border-border/70 bg-background shadow-2xl shadow-black/40", children: [(0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "flex flex-row items-center justify-between space-y-0 border-b border-border/60 bg-card/40 px-4 py-2.5", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Gamepad2, { size: 14, className: "text-accent", "aria-hidden": true }), "playable: ", project, "/", version] }), (0, jsx_runtime_1.jsx)(button_1.Button, { variant: "ghost", size: "sm", className: "h-8 gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-accent", asChild: true, children: (0, jsx_runtime_1.jsxs)("a", { href: iframeSrc, target: "_blank", rel: "noopener noreferrer", children: ["Open full screen", (0, jsx_runtime_1.jsx)(lucide_react_1.ExternalLink, { className: "!size-2.5", "aria-hidden": true })] }) })] }), (0, jsx_runtime_1.jsx)(card_1.CardContent, { className: "p-0", children: (0, jsx_runtime_1.jsx)("div", { className: "aspect-[16/10] w-full", children: (0, jsx_runtime_1.jsx)("iframe", { src: iframeSrc, title: `${project} ${version}`, className: "h-full w-full bg-[#1a1a2e]", loading: "lazy", sandbox: "allow-scripts allow-same-origin allow-pointer-lock" }, iframeSrc) }) })] }) }));
}
