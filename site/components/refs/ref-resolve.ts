import {
  ALL_DECISIONS,
  ALL_TASKS,
  ALL_PHASES,
  OPEN_QUESTIONS,
  BUGS,
} from "@/lib/eval-data";
import type { RefKind, ResolvedRef } from "./ref-types";

export function resolveRef(id: string): ResolvedRef {
  const base = { detail: null as Record<string, string> | null };

  const newFmt = id.match(/^([A-Z]+)-([DTPRBS])-(.+)$/);
  if (newFmt) {
    const [, ns, typeCode, num] = newFmt;
    const typeMap: Record<string, RefKind> = {
      D: "decision",
      T: "task",
      P: "phase",
      R: "requirement",
      B: "bug",
      S: "unknown",
    };
    const kind = typeMap[typeCode] || "unknown";

    if (kind === "decision") {
      const legacyId = `gad-${num}`;
      const decision = ALL_DECISIONS.find((d) => d.id === legacyId);
      return {
        ...base,
        href: `/decisions#${legacyId}`,
        label: id,
        preview: decision?.title ?? null,
        detail: decision
          ? { Status: "captured", Summary: decision.summary?.slice(0, 200) || "" }
          : null,
        found: !!decision,
        kind,
        segments: { namespace: ns, type: typeCode, number: num },
      };
    }
    if (kind === "task") {
      const task = ALL_TASKS.find((t) => t.id === num);
      const parts = num.split("-");
      return {
        ...base,
        href: `/planning?tab=tasks#${num}`,
        label: id,
        preview: task ? task.goal.slice(0, 180) : null,
        detail: task
          ? { Phase: parts[0] || "", Status: task.status, Goal: task.goal.slice(0, 150) }
          : null,
        found: !!task,
        kind,
        segments: { namespace: ns, type: typeCode, number: num },
      };
    }
    if (kind === "phase") {
      const phase = ALL_PHASES.find((p) => p.id === num);
      return {
        ...base,
        href: `/planning?tab=phases#${num}`,
        label: id,
        preview: phase?.title ?? null,
        detail: phase ? { Status: phase.status, Title: phase.title } : null,
        found: !!phase,
        kind,
        segments: { namespace: ns, type: typeCode, number: num },
      };
    }
  }

  if (/^gad-\d+$/i.test(id)) {
    const canonical = id.toLowerCase();
    const decision = ALL_DECISIONS.find((d) => d.id === canonical);
    return {
      ...base,
      href: `/decisions#${canonical}`,
      label: canonical,
      preview: decision?.title ?? null,
      detail: decision ? { Summary: decision.summary?.slice(0, 200) || "" } : null,
      found: !!decision,
      kind: "decision",
      segments: { namespace: "GAD", type: "D", number: canonical.replace("gad-", "") },
    };
  }

  if (/^\d{2}-\d{2}(-\d+[a-z]?)?$/i.test(id)) {
    const task = ALL_TASKS.find((t) => t.id === id);
    const parts = id.split("-");
    return {
      ...base,
      href: `/planning?tab=tasks#${id}`,
      label: `T-${id}`,
      preview: task ? task.goal.slice(0, 180) : null,
      detail: task ? { Phase: parts[0], Status: task.status, Goal: task.goal.slice(0, 150) } : null,
      found: !!task,
      kind: "task",
      segments: { namespace: "GAD", type: "T", number: id },
    };
  }

  const phaseMatch = id.match(/^(?:P-)?(\d{1,3}(?:\.\d+)?)$/i);
  if (phaseMatch) {
    const phaseId = phaseMatch[1];
    const phase = ALL_PHASES.find((p) => p.id === phaseId);
    return {
      ...base,
      href: `/planning?tab=phases#${phaseId}`,
      label: `P-${phaseId}`,
      preview: phase?.title ?? null,
      detail: phase ? { Status: phase.status, Title: phase.title } : null,
      found: !!phase,
      kind: "phase",
      segments: { namespace: "GAD", type: "P", number: phaseId },
    };
  }

  if (/^R-v\d+/i.test(id)) {
    return {
      ...base,
      href: `/requirements#${id}`,
      label: id,
      preview: `Requirement ${id}`,
      found: true,
      kind: "requirement",
      segments: { type: "R", number: id.replace("R-", "") },
    };
  }

  const questionId = id.replace(/^Q-/, "");
  const question = (OPEN_QUESTIONS ?? []).find((q) => q.id === questionId);
  if (question) {
    return {
      ...base,
      href: `/methodology#${question.id}`,
      label: `Q-${question.id}`,
      preview: question.title,
      found: true,
      kind: "question",
      segments: { type: "Q", number: question.id },
    };
  }

  const bugId = id.replace(/^B-/, "");
  const bug = (BUGS ?? []).find((b) => b.id === bugId);
  if (bug) {
    return {
      ...base,
      href: `/planning?tab=bugs#${bug.id}`,
      label: `B-${bug.id}`,
      preview: bug.title,
      found: true,
      kind: "bug",
      segments: { type: "B", number: bug.id },
    };
  }

  return {
    ...base,
    href: null,
    label: id,
    preview: null,
    found: false,
    kind: "unknown",
    segments: { number: id },
  };
}
