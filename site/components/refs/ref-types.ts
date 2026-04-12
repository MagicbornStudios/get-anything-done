export type RefKind =
  | "decision"
  | "task"
  | "phase"
  | "requirement"
  | "question"
  | "bug"
  | "unknown";

export interface ResolvedRef {
  href: string | null;
  label: string;
  preview: string | null;
  detail: Record<string, string> | null;
  found: boolean;
  kind: RefKind;
  segments: { namespace?: string; type?: string; number: string };
}
