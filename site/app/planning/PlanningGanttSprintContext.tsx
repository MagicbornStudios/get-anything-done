"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PlanningPhase } from "@/lib/catalog.generated";

const DEFAULT_SPRINT_SIZE = 5;

export type PlanningGanttSprintContextValue = {
  phases: PlanningPhase[];
  sprintSize: number;
  sprintOffset: number;
  totalSprints: number;
  currentSprintNum: number;
  onSprintSizeDelta: (delta: number) => void;
  onPrevSprint: () => void;
  onNextSprint: () => void;
};

const PlanningGanttSprintContext = createContext<PlanningGanttSprintContextValue | null>(null);

export function usePlanningGanttSprint(): PlanningGanttSprintContextValue {
  const ctx = useContext(PlanningGanttSprintContext);
  if (!ctx) {
    throw new Error("usePlanningGanttSprint must be used within PlanningGanttSprintProvider");
  }
  return ctx;
}

export function PlanningGanttSprintProvider({
  phases,
  children,
}: {
  phases: PlanningPhase[];
  children: ReactNode;
}) {
  const phasesLength = phases.length;
  const [sprintSize, setSprintSize] = useState(DEFAULT_SPRINT_SIZE);
  const [sprintOffset, setSprintOffset] = useState(() => {
    const activeIdx = phases.findIndex((p) => p.status === "active");
    const idx = activeIdx >= 0 ? activeIdx : phases.length - 1;
    return Math.floor(idx / DEFAULT_SPRINT_SIZE) * DEFAULT_SPRINT_SIZE;
  });

  const totalSprints = Math.ceil(phasesLength / sprintSize) || 1;
  const currentSprintNum = Math.floor(sprintOffset / sprintSize) + 1;

  const onSprintSizeDelta = useCallback((delta: number) => {
    setSprintSize((s) => Math.min(15, Math.max(3, s + delta)));
  }, []);

  const onPrevSprint = useCallback(() => {
    setSprintOffset((o) => Math.max(0, o - sprintSize));
  }, [sprintSize]);

  const onNextSprint = useCallback(() => {
    setSprintOffset((o) => Math.min((totalSprints - 1) * sprintSize, o + sprintSize));
  }, [sprintSize, totalSprints]);

  const value = useMemo<PlanningGanttSprintContextValue>(
    () => ({
      phases,
      sprintSize,
      sprintOffset,
      totalSprints,
      currentSprintNum,
      onSprintSizeDelta,
      onPrevSprint,
      onNextSprint,
    }),
    [
      phases,
      sprintSize,
      sprintOffset,
      totalSprints,
      currentSprintNum,
      onSprintSizeDelta,
      onPrevSprint,
      onNextSprint,
    ],
  );

  return (
    <PlanningGanttSprintContext.Provider value={value}>{children}</PlanningGanttSprintContext.Provider>
  );
}
