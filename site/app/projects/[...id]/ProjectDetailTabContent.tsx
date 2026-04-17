"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { type ReactNode, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { DetailTab } from "./ProjectDetailTabs";
import { ProjectPlanningTasksTab } from "./ProjectPlanningTasksTab";
import { ProjectPlanningRequirementsTab } from "./ProjectPlanningRequirementsTab";
import { ProjectPlanningNotesTab } from "./ProjectPlanningNotesTab";
import { ProjectSystemTab } from "./ProjectSystemTab";
import { ProjectEvolutionTab } from "./ProjectEvolutionTab";

const PLANNING_SUBTABS = [
  { key: "tasks", label: "Tasks" },
  { key: "decisions", label: "Decisions" },
  { key: "roadmap", label: "Roadmap" },
  { key: "requirements", label: "Requirements" },
  { key: "notes", label: "Notes" },
] as const;

type PlanningSubTab = (typeof PLANNING_SUBTABS)[number]["key"];

const DEFAULT_PLANNING_SUBTAB: PlanningSubTab = "tasks";

export function ProjectDetailTabContent({
  activeTab,
  overviewContent,
  projectId,
}: {
  activeTab: DetailTab;
  overviewContent: ReactNode;
  projectId: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawSub = searchParams.get("sub");
  const planningSubTab: PlanningSubTab =
    PLANNING_SUBTABS.some((t) => t.key === rawSub)
      ? (rawSub as PlanningSubTab)
      : DEFAULT_PLANNING_SUBTAB;

  const setPlanningSubTab = useCallback(
    (sub: PlanningSubTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (sub === DEFAULT_PLANNING_SUBTAB) {
        params.delete("sub");
      } else {
        params.set("sub", sub);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  if (activeTab === "overview") {
    return <>{overviewContent}</>;
  }

  if (activeTab === "planning") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div
          data-cid="project-planning-subtabs"
          className="mb-6 flex gap-0 border-b border-border/40"
        >
          {PLANNING_SUBTABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              data-cid={`project-planning-subtab-${tab.key}`}
              onClick={() => setPlanningSubTab(tab.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                planningSubTab === tab.key
                  ? "border-b-2 border-accent text-accent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {planningSubTab === "tasks" && (
          <ProjectPlanningTasksTab projectId={projectId} />
        )}
        {planningSubTab === "decisions" && (
          <p className="text-sm text-muted-foreground">Decisions — coming soon (task 45-07)</p>
        )}
        {planningSubTab === "roadmap" && (
          <p className="text-sm text-muted-foreground">Roadmap — coming soon (task 45-08)</p>
        )}
        {planningSubTab === "requirements" && (
          <ProjectPlanningRequirementsTab projectId={projectId} />
        )}
        {planningSubTab === "notes" && (
          <ProjectPlanningNotesTab projectId={projectId} />
        )}
      </div>
    );
  }

  if (activeTab === "system") {
    return <ProjectSystemTab projectId={projectId} />;
  }

  return <ProjectEvolutionTab projectId={projectId} />;
}
