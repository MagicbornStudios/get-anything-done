"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PlanningState } from "@/lib/catalog.generated";
import { REQUIREMENTS_HISTORY } from "@/lib/catalog.generated";
import type { TaskRecord, PhaseRecord, DecisionRecord, BugRecord } from "@/lib/eval-data";
import { SiteSection } from "@/components/site";
import { PlanningSkillCandidatesTab, type SkillCandidate } from "@/app/planning/PlanningSkillCandidatesTab";
import { PlanningSystemTab } from "@/app/planning/PlanningSystemTab";
import { PlanningPhasesTab } from "@/app/planning/PlanningPhasesTab";
import { PlanningTasksTab } from "@/app/planning/PlanningTasksTab";
import { PlanningDecisionsTab } from "@/app/planning/PlanningDecisionsTab";
import { PlanningRoadmapTab } from "@/app/planning/PlanningRoadmapTab";
import { PlanningRequirementsTab } from "@/app/planning/PlanningRequirementsTab";
import { PlanningBugsTab } from "@/app/planning/PlanningBugsTab";
import selfEvalData from "@/data/self-eval.json";

interface Props {
  state: PlanningState;
  allTasks: TaskRecord[];
  allPhases: PhaseRecord[];
  allDecisions: DecisionRecord[];
  gadBugs: BugRecord[];
}

export function PlanningTabbedContent({ state, allTasks, allPhases, allDecisions, gadBugs }: Props) {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "system";

  const openTasks = allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const doneTasks = allTasks.filter((t) => t.status === "done");
  const versions = REQUIREMENTS_HISTORY ?? [];
  const topOpen = openTasks.slice(0, 40);
  const allCandidates = (selfEvalData.latest?.skill_candidates ?? []) as SkillCandidate[];
  // Phase 42 split: stage="candidate" = raw, awaiting drafting; stage="drafted" = proto-skill awaiting review.
  // Items without a stage field (legacy data) default to "candidate" for backwards compat.
  const skillCandidates = allCandidates.filter((c) => (c.stage ?? "candidate") === "candidate");
  const protoSkills = allCandidates.filter((c) => c.stage === "drafted");

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    if (!hash) return;
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [defaultTab, allTasks.length, state.phases.length, gadBugs.length]);

  return (
    <SiteSection>
      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="phases">
            Phases <span className="ml-1.5 tabular-nums text-muted-foreground">{allPhases.length}</span>
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks <span className="ml-1.5 tabular-nums text-muted-foreground">{allTasks.length}</span>
          </TabsTrigger>
          <TabsTrigger value="decisions">
            Decisions <span className="ml-1.5 tabular-nums text-muted-foreground">{allDecisions.length}</span>
          </TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="requirements">
            Requirements <span className="ml-1.5 tabular-nums text-muted-foreground">{versions.length}</span>
          </TabsTrigger>
          {gadBugs.length > 0 && (
            <TabsTrigger value="bugs">
              Bugs <span className="ml-1.5 tabular-nums text-muted-foreground">{gadBugs.length}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="skill-candidates">
            Candidates{" "}
            <span className="ml-1.5 tabular-nums text-muted-foreground">{skillCandidates.length}</span>
          </TabsTrigger>
          <TabsTrigger value="proto-skills">
            Proto-skills{" "}
            <span className="ml-1.5 tabular-nums text-muted-foreground">{protoSkills.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system">
          <PlanningSystemTab selfEval={selfEvalData.latest} />
        </TabsContent>

        <TabsContent value="phases">
          <PlanningPhasesTab phases={state.phases} />
        </TabsContent>

        <TabsContent value="tasks">
          <PlanningTasksTab allTasks={allTasks} openTasks={openTasks} doneTasks={doneTasks} topOpen={topOpen} />
        </TabsContent>

        <TabsContent value="decisions">
          <PlanningDecisionsTab allDecisions={allDecisions} />
        </TabsContent>

        <TabsContent value="roadmap">
          <PlanningRoadmapTab phases={state.phases} allTasks={allTasks} />
        </TabsContent>

        <TabsContent value="requirements">
          <PlanningRequirementsTab versions={versions} />
        </TabsContent>

        {gadBugs.length > 0 && (
          <TabsContent value="bugs">
            <PlanningBugsTab gadBugs={gadBugs} />
          </TabsContent>
        )}

        <TabsContent value="skill-candidates">
          <PlanningSkillCandidatesTab candidates={skillCandidates} />
        </TabsContent>

        <TabsContent value="proto-skills">
          <PlanningSkillCandidatesTab candidates={protoSkills} />
        </TabsContent>
      </Tabs>
    </SiteSection>
  );
}
