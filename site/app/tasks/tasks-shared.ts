import type { ComponentType } from "react";
import { Check, CircleDot, X } from "lucide-react";
import type { TaskRecord } from "@/lib/eval-data";

const REPO = "https://github.com/MagicbornStudios/get-anything-done";
export const TASK_FILE_URL = `${REPO}/blob/main/.planning/TASK-REGISTRY.xml`;

export const STATUS_TINT: Record<string, "success" | "default" | "outline" | "danger"> = {
  done: "success",
  "in-progress": "default",
  blocked: "danger",
  planned: "outline",
  cancelled: "outline",
};

type StatusIconProps = { size?: number; className?: string; "aria-hidden"?: boolean };
type StatusIcon = ComponentType<StatusIconProps>;

export const STATUS_ICON: Record<string, StatusIcon> = {
  done: Check,
  "in-progress": CircleDot,
  blocked: X,
  planned: CircleDot,
  cancelled: X,
};

export function groupByPhase(tasks: TaskRecord[]) {
  const groups = new Map<string, TaskRecord[]>();
  for (const t of tasks) {
    const arr = groups.get(t.phaseId) ?? [];
    arr.push(t);
    groups.set(t.phaseId, arr);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
