"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectCard = ProjectCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const Identified_1 = require("@/components/devid/Identified");
const link_1 = __importDefault(require("next/link"));
const lucide_react_1 = require("lucide-react");
const badge_1 = require("@/components/ui/badge");
const card_1 = require("@/components/ui/card");
const utils_1 = require("@/lib/utils");
const project_market_shared_1 = require("@/components/project-market/project-market-shared");
const playable_shared_1 = require("@/components/landing/playable/playable-shared");
// Deterministic hash → 0..360 hue. Used to pick gradient colors per project
// so every card has a stable visual identity even without a real card image.
function hashHue(seed, salt = 0) {
    let h = 2166136261 ^ salt;
    for (let i = 0; i < seed.length; i += 1) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h) % 360;
}
function gradientForProject(p) {
    const h1 = hashHue(p.id, 0);
    const h2 = hashHue(p.id, 1337);
    // Domain nudges lightness so game cards feel different from writing cards.
    const lightByDomain = {
        game: 40, video: 35, software: 38, tooling: 42, planning: 30,
    };
    const l1 = lightByDomain[p.domain] ?? 38;
    return `linear-gradient(135deg, hsl(${h1} 70% ${l1}%) 0%, hsl(${h2} 65% ${Math.max(15, l1 - 18)}%) 100%)`;
}
function initialsForProject(name) {
    const words = name.replace(/[\/_-]/g, " ").split(/\s+/).filter(Boolean);
    if (words.length >= 2)
        return (words[0][0] + words[1][0]).toUpperCase();
    return (words[0]?.slice(0, 2) ?? "??").toUpperCase();
}
function ProjectCard({ project }) {
    return ((0, jsx_runtime_1.jsx)(Identified_1.Identified, { as: "ProjectCard", className: "contents", children: (0, jsx_runtime_1.jsxs)(card_1.Card, { className: (0, utils_1.cn)("group relative flex flex-col overflow-hidden border-border/70 bg-card/40 shadow-none transition-all hover:border-accent/40 hover:bg-card/60 hover:shadow-lg hover:shadow-accent/5", project.featured && "ring-1 ring-accent/20"), children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative aspect-[16/9] w-full overflow-hidden", style: { background: gradientForProject(project) }, children: [(0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.18),transparent_60%)]" }), (0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 flex items-center justify-center", children: (0, jsx_runtime_1.jsx)("span", { className: "font-mono text-5xl font-bold tracking-tight text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]", children: initialsForProject(project.name) }) }), project.featured && ((0, jsx_runtime_1.jsx)("div", { className: "absolute right-2 top-2", children: (0, jsx_runtime_1.jsxs)(badge_1.Badge, { className: "gap-1 border-amber-500/40 bg-amber-500/20 text-amber-200 backdrop-blur-sm", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Star, { size: 10, className: "fill-amber-400", "aria-hidden": true }), "Featured"] }) })), project.species && ((0, jsx_runtime_1.jsx)("div", { className: "absolute left-2 top-2", children: (0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "border-white/30 bg-black/30 text-[10px] uppercase tracking-wider text-white backdrop-blur-sm", children: project.species }) })), (project.runCount > 0 || project.playableCount > 0) && ((0, jsx_runtime_1.jsxs)("div", { className: "absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm", children: [project.runCount > 0 && ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Gamepad2, { size: 10, "aria-hidden": true }), project.runCount] })), project.playableCount > 0 && ((0, jsx_runtime_1.jsxs)("span", { className: "text-emerald-300", children: ["\u25B6 ", project.playableCount] }))] }))] }), (0, jsx_runtime_1.jsxs)(card_1.CardContent, { className: "flex flex-1 flex-col gap-3 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-1.5", children: [(0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: (0, utils_1.cn)("text-[10px] uppercase tracking-wider", project_market_shared_1.DOMAIN_TINT[project.domain]), children: project_market_shared_1.DOMAIN_LABELS[project.domain] }), project.techStack && ((0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "border-sky-500/40 bg-sky-500/10 text-[10px] text-sky-300", children: project.techStack })), project.contextFramework && project.contextFramework !== project.species && ((0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: "border-purple-500/40 bg-purple-500/10 text-[10px] text-purple-300", children: project.contextFramework })), project.workflow && project.workflow !== project.contextFramework && ((0, jsx_runtime_1.jsx)(badge_1.Badge, { variant: "outline", className: (0, utils_1.cn)("text-[10px] uppercase tracking-wider", playable_shared_1.WORKFLOW_TINT[project.workflow] ?? "border-border/70 text-muted-foreground"), children: project.workflow }))] }), (0, jsx_runtime_1.jsx)("h3", { className: "text-sm font-semibold leading-tight text-foreground", children: project.name }), project.description && ((0, jsx_runtime_1.jsx)("p", { className: "line-clamp-2 flex-1 text-xs leading-5 text-muted-foreground", children: project.description })), project.latestRound && ((0, jsx_runtime_1.jsxs)("div", { className: "text-[11px] text-muted-foreground", children: ["Latest: ", (0, jsx_runtime_1.jsx)("span", { className: "text-foreground", children: project.latestRound })] })), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-3 pt-1", children: (0, jsx_runtime_1.jsxs)(link_1.default, { href: `/projects/${project.id}`, className: "inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline", children: ["View project", (0, jsx_runtime_1.jsx)(lucide_react_1.ExternalLink, { size: 10, "aria-hidden": true })] }) })] })] }) }));
}
