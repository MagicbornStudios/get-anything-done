import type { LucideIcon } from "lucide-react";
import { Bot, Sparkles, Wrench } from "lucide-react";
import {
  AGENTS,
  COMMANDS,
  SKILLS,
  type CatalogAgent,
  type CatalogCommand,
  type CatalogSkill,
} from "@/lib/catalog.generated";

export type CatalogTab = "skills" | "agents" | "commands";

export type CatalogItem = CatalogSkill | CatalogAgent | CatalogCommand;

export const DETAIL_PREFIX: Record<CatalogTab, string> = {
  skills: "/skills",
  agents: "/agents",
  commands: "/commands",
};

export const TAB_META: Record<CatalogTab, { label: string; icon: LucideIcon; count: number }> = {
  skills: { label: "Skills", icon: Sparkles, count: SKILLS.length },
  agents: { label: "Subagents", icon: Bot, count: AGENTS.length },
  commands: { label: "Commands", icon: Wrench, count: COMMANDS.length },
};

/** Toolbar / navigation order — do not rely on `Object.keys(TAB_META)`. */
export const CATALOG_TABS: CatalogTab[] = ["skills", "agents", "commands"];

export function sourceItemsForTab(tab: CatalogTab): CatalogItem[] {
  return tab === "skills" ? SKILLS : tab === "agents" ? AGENTS : COMMANDS;
}

export function filterCatalogItems(items: CatalogItem[], query: string): CatalogItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
  );
}
