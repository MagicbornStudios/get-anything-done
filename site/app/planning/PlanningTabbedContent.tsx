"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HumanWorkflow, PlanningState, Signal, Workflow } from "@/lib/catalog.generated";
import { HUMAN_WORKFLOWS, REQUIREMENTS_HISTORY, SIGNAL, WORKFLOWS } from "@/lib/catalog.generated";
import type { TaskRecord, PhaseRecord, DecisionRecord, BugRecord } from "@/lib/eval-data";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";
import { PlanningBugsTab } from "./PlanningBugsTab";
import { PlanningDecisionsTab } from "./PlanningDecisionsTab";
import { PlanningPhasesTab } from "./PlanningPhasesTab";
import { PlanningRequirementsTab } from "./PlanningRequirementsTab";
import { PlanningRoadmapTab } from "./PlanningRoadmapTab";
import { PlanningSkillCandidatesTab, type SkillCandidate } from "./PlanningSkillCandidatesTab";
import { PlanningSystemTab } from "./PlanningSystemTab";
import { PlanningTasksTab } from "./PlanningTasksTab";
import { PlanningTabHumanWorkflows } from "./PlanningTabHumanWorkflows";
import { PlanningTabSignal } from "./PlanningTabSignal";
import { PlanningWorkflowsTab } from "./PlanningWorkflowsTab";
import selfEvalData from "@/data/self-eval.json";

interface Props {
  state: PlanningState;
  allTasks: TaskRecord[];
  allPhases: PhaseRecord[];
  allDecisions: DecisionRecord[];
  gadBugs: BugRecord[];
  humanWorkflows?: readonly HumanWorkflow[];
  signal?: Signal;
}

const BASE_PLANNING_TABS = new Set([
  "system",
  "phases",
  "tasks",
  "decisions",
  "roadmap",
  "requirements",
  "skill-candidates",
  "proto-skills",
  "workflows",
  "human-workflows",
  "signal",
]);

const WORKFLOWS_DATA: readonly Workflow[] = WORKFLOWS;
const HUMAN_WORKFLOWS_DATA: readonly HumanWorkflow[] = HUMAN_WORKFLOWS;
const SIGNAL_DATA: Signal = SIGNAL;

export function PlanningTabbedContent({
  state,
  allTasks,
  allPhases,
  allDecisions,
  gadBugs,
  humanWorkflows = HUMAN_WORKFLOWS_DATA,
  signal = SIGNAL_DATA,
}: Props) {
  const searchParams = useSearchParams();
  const defaultTab = useMemo(() => {
    const raw = searchParams.get("tab") || "system";
    if (raw === "bugs") return gadBugs.length > 0 ? "bugs" : "system";
    return BASE_PLANNING_TABS.has(raw) ? raw : "system";
  }, [searchParams, gadBugs.length]);

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
    <SiteSection cid="planning-tabbed-content-site-section">
      <Identified as="PlanningTabbedContent">
      <Tabs key={defaultTab} defaultValue={defaultTab}>
        <Identified as="PlanningTabsList" className="mb-6">
          <TabsList className="flex-wrap">
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
          <TabsTrigger value="workflows">
            Workflows{" "}
            <span className="ml-1.5 tabular-nums text-muted-foreground">{WORKFLOWS_DATA.length}</span>
          </TabsTrigger>
          <TabsTrigger value="human-workflows">
            Human Workflows{" "}
            <span className="ml-1.5 tabular-nums text-muted-foreground">{humanWorkflows.length}</span>
          </TabsTrigger>
          <TabsTrigger value="signal">
            Signal{" "}
            <span className="ml-1.5 tabular-nums text-muted-foreground">{signal.totalEvents}</span>
          </TabsTrigger>
        </TabsList>
        </Identified>

        <TabsContent value="system">
          <Identified as="PlanningTabSystem">
            <PlanningSystemTab selfEval={selfEvalData.latest} />
          </Identified>
        </TabsContent>

        <TabsContent value="phases">
          <Identified as="PlanningTabPhases">
            <PlanningPhasesTab phases={state.phases} />
          </Identified>
        </TabsContent>

        <TabsContent value="tasks">
          <Identified as="PlanningTabTasks">
            <PlanningTasksTab allTasks={allTasks} openTasks={openTasks} doneTasks={doneTasks} topOpen={topOpen} />
          </Identified>
        </TabsContent>

        <TabsContent value="decisions">
          <Identified as="PlanningTabDecisions">
            <PlanningDecisionsTab allDecisions={allDecisions} />
          </Identified>
        </TabsContent>

        <TabsContent value="roadmap">
          <Identified as="PlanningTabRoadmap">
            <PlanningRoadmapTab phases={state.phases} allTasks={allTasks} />
          </Identified>
        </TabsContent>

        <TabsContent value="requirements">
          <Identified as="PlanningTabRequirements">
            <PlanningRequirementsTab versions={versions} />
          </Identified>
        </TabsContent>

        {gadBugs.length > 0 && (
          <TabsContent value="bugs">
            <Identified as="PlanningTabBugs">
              <PlanningBugsTab gadBugs={gadBugs} />
            </Identified>
          </TabsContent>
        )}

        <TabsContent value="skill-candidates">
          <Identified as="PlanningTabSkillCandidates">
            <PlanningSkillCandidatesTab candidates={skillCandidates} />
          </Identified>
        </TabsContent>

        <TabsContent value="proto-skills">
          <Identified as="PlanningTabProtoSkills">
            <PlanningSkillCandidatesTab candidates={protoSkills} />
          </Identified>
        </TabsContent>

        <TabsContent value="workflows">
          <Identified as="PlanningTabWorkflows">
            <PlanningWorkflowsTab workflows={WORKFLOWS_DATA} />
          </Identified>
        </TabsContent>

        <TabsContent value="human-workflows">
          <PlanningTabHumanWorkflows workflows={humanWorkflows} />
        </TabsContent>

        <TabsContent value="signal">
          <PlanningTabSignal signal={signal} />
        </TabsContent>
      </Tabs>
      </Identified>
    </SiteSection>
  );
}

