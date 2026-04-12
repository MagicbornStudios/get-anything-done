import { Bot, Package, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AGENTS, SKILLS, TEMPLATES } from "@/lib/catalog.generated";

const OFFICIAL_SKILLS = SKILLS.filter((skill) => skill.source === "sdk");

export type GadCoreConcept = {
  icon: LucideIcon;
  title: string;
  count: number;
  description: string;
  href: string;
  chip: string;
};

export const GAD_CORE_CONCEPTS: GadCoreConcept[] = [
  {
    icon: Sparkles,
    title: "Skills",
    count: OFFICIAL_SKILLS.length,
    description:
      "Methodology docs the agent follows. Official consumer skills live under sdk/skills and are the installable public surface; root skills are internal methodology for evolving GAD itself.",
    href: "/#catalog",
    chip: "-> browse skills",
  },
  {
    icon: Bot,
    title: "Subagents",
    count: AGENTS.length,
    description:
      "Specialised workers the framework spawns for planning, research, verification, UI audits, and more. Subagents receive a task plus context and return a concrete artifact such as PLAN.md, RESEARCH.md, or VERIFICATION.md.",
    href: "/#catalog",
    chip: "-> browse subagents",
  },
  {
    icon: Package,
    title: "Templates",
    count: TEMPLATES.length,
    description:
      "The planning-doc scaffolding and workflow templates the CLI uses to bootstrap new projects. These live under sdk/templates and ship with the framework's runtime assets.",
    href: "/#templates",
    chip: "-> download pack",
  },
];
