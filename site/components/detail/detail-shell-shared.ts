import type { ReactNode } from "react";

export interface DetailShellProps {
  kind: "skill" | "subagent" | "command" | "finding";
  backHref: string;
  backLabel: string;
  name: string;
  subtitle?: string;
  description?: string;
  badges?: Array<{ label: string; variant?: "default" | "outline" | "success" | "danger" }>;
  meta?: Array<{ label: string; value: ReactNode }>;
  sourcePath?: string;
  bodyHtml: string;
  sidebar?: ReactNode;
}

export const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export const KIND_LABELS: Record<DetailShellProps["kind"], string> = {
  skill: "Skill",
  subagent: "Subagent",
  command: "Command",
  finding: "Finding",
};
