export const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export interface SkillArtifact {
  name: string;
  bytes: number;
  /** Optional raw content — if provided, clicking opens a modal with this text */
  content?: string | null;
  /** Source path in the repo */
  file?: string | null;
  /** Matching skill id in the catalog, if resolvable */
  skillId?: string | null;
}

export interface SkillLineageCardProps {
  runKey: string;
  version: string;
  date: string | null;
  playable: boolean;
  projectHref: string;
  runHref: string;
  skills: SkillArtifact[];
}
