import { Bot, Package, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AGENTS, SKILLS, TEMPLATES } from "@/lib/catalog.generated";

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
    count: SKILLS.length,
    description:
      "Methodology docs the agent follows. The framework skill catalog lives under skills, with installable, emergent, and experimental entries carried as metadata inside the same tree.",
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
      "The planning-doc scaffolding and workflow templates the CLI uses to bootstrap new projects. These live under templates and ship with the framework's runtime assets.",
    href: "/#templates",
    chip: "-> download pack",
  },
];

