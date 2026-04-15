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
  origin: "official" | "proto";
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
  official: "Official",
  proto: "Proto",
};

export const SKILL_CATEGORIES = [
  "all",
  "official",
  "proto",
] as const;
