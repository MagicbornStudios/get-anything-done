import { ALL_TASKS } from "@/lib/eval-data";

export const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export const STATUS_TINT: Record<string, "success" | "default" | "outline"> = {
  done: "success",
  "in-progress": "default",
  active: "default",
  planned: "outline",
  blocked: "outline",
};

export function tasksForPhase(phaseId: string) {
  return ALL_TASKS.filter((t) => t.phaseId === phaseId);
}
