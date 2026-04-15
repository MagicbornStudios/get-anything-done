export interface SkillSummaryDTO {
  id: string;
  name: string;
  description: string;
  imagePath: string | null;
  inheritedBy: string[];
  isFundamental: boolean;
  isFrameworkSkill: boolean;
  authoredByEvals: string[];
  category: string;
}

export interface SkillUsageDTO {
  skill: string;
  count: number;
  tasks: { id: string; phaseId: string; status: string; goal: string }[];
  isCatalogMatch: boolean;
}

export interface AgentUsageDTO {
  agent: string;
  count: number;
  tasksByType: Record<string, number>;
  skills: string[];
}

export const CATEGORY_LABEL: Record<string, string> = {
  fundamental: "Fundamental",
  "eval-authored": "Eval-authored",
  "framework-inherited": "Framework — inherited",
  "framework-only": "Framework — not inherited",
};

export const SKILL_CATEGORIES = [
  "all",
  "fundamental",
  "eval-authored",
  "framework-inherited",
  "framework-only",
] as const;
