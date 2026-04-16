"use client";

import { useEffect, useMemo } from "react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HumanWorkflow, PlanningState, Signal, Workflow } from "@/lib/catalog.generated";
import { HUMAN_WORKFLOWS, REQUIREMENTS_HISTORY, SIGNAL, WORKFLOWS } from "@/lib/catalog.generated";
import type { TaskRecord, PhaseRecord, DecisionRecord, BugRecord } from "@/lib/eval-data";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";
import type { SkillCandidate } from "./PlanningSkillCandidatesTab";
import type { PlanningSelfEvalLatest } from "./PlanningSystemTab";

const PlanningBugsTab = dynamic(() =>
  import("./PlanningBugsTab").then((m) => m.PlanningBugsTab),
);
const PlanningDecisionsTab = dynamic(() =>
  import("./PlanningDecisionsTab").then((m) => m.PlanningDecisionsTab),
);
const PlanningPhasesTab = dynamic(() =>
  import("./PlanningPhasesTab").then((m) => m.PlanningPhasesTab),
);
const PlanningRequirementsTab = dynamic(() =>
  import("./PlanningRequirementsTab").then((m) => m.PlanningRequirementsTab),
);
const PlanningRoadmapTab = dynamic(() =>
  import("./PlanningRoadmapTab").then((m) => m.PlanningRoadmapTab),
);
const PlanningSkillCandidatesTab = dynamic(() =>
  import("./PlanningSkillCandidatesTab").then((m) => m.PlanningSkillCandidatesTab),
);
const PlanningSystemTab = dynamic(() =>
  import("./PlanningSystemTab").then((m) => m.PlanningSystemTab),
);
const PlanningTasksTab = dynamic(() =>
  import("./PlanningTasksTab").then((m) => m.PlanningTasksTab),
);
const PlanningWorkflowsTab = dynamic(() =>
  import("./PlanningWorkflowsTab").then((m) => m.PlanningWorkflowsTab),
);

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
  "planning",
  "skill-candidates",
  "proto-skills",
  "workflows",
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
  const [activeTab, setActiveTab] = useState("system");
  const [selfEvalLatest, setSelfEvalLatest] = useState<PlanningSelfEvalLatest | null>(null);
  const [selfEvalCandidates, setSelfEvalCandidates] = useState<SkillCandidate[]>([]);
  const defaultTab = useMemo(() => {
    const raw = searchParams.get("tab") || "system";
    if (raw === "bugs") return gadBugs.length > 0 ? "bugs" : "system";
    if (raw === "signal") return "workflows";
    if (raw === "human-workflows" || raw === "discovery") return "workflows";
    if (raw === "phases" || raw === "tasks" || raw === "decisions") return "planning";
    return BASE_PLANNING_TABS.has(raw) ? raw : "system";
  }, [searchParams, gadBugs.length]);
  const planningInnerDefault = useMemo(() => {
    const raw = searchParams.get("tab") || "";
    if (raw === "phases" || raw === "tasks" || raw === "decisions") return raw;
    return "phases";
  }, [searchParams]);

  const openTasks = allTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const doneTasks = allTasks.filter((t) => t.status === "done");
  const versions = REQUIREMENTS_HISTORY ?? [];
  const topOpen = openTasks.slice(0, 40);
  const allCandidates = selfEvalCandidates;
  const skillCandidates = allCandidates.filter((c) => (c.stage ?? "candidate") === "candidate");
  const protoSkills = allCandidates.filter((c) => c.stage === "drafted");

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (
      selfEvalLatest ||
      (activeTab !== "system" &&
        activeTab !== "skill-candidates" &&
        activeTab !== "proto-skills")
    ) {
      return;
    }
    let cancelled = false;
    void import("@/data/self-eval.json").then((mod) => {
      if (cancelled) return;
      const latest = (mod.default as { latest?: PlanningSelfEvalLatest & { skill_candidates?: SkillCandidate[] } }).latest;
      setSelfEvalLatest(latest ?? null);
      setSelfEvalCandidates(latest?.skill_candidates ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, selfEvalLatest]);

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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <Identified as="PlanningTabsList" className="mb-6">
            <TabsList className="flex-wrap">
              <Identified as="PlanningTabsTriggerSystem">
                <TabsTrigger value="system">System</TabsTrigger>
              </Identified>
              <Identified as="PlanningTabsTriggerPlanning">
                <TabsTrigger value="planning">
                  Planning{" "}
                  <span className="ml-1.5 tabular-nums text-muted-foreground">
                    {allPhases.length + allTasks.length + allDecisions.length + versions.length}
                  </span>
                </TabsTrigger>
              </Identified>
              {gadBugs.length > 0 && (
                <TabsTrigger value="bugs">
                  Bugs <span className="ml-1.5 tabular-nums text-muted-foreground">{gadBugs.length}</span>
                </TabsTrigger>
              )}
              <Identified as="PlanningTabsTriggerCandidates">
                <TabsTrigger value="skill-candidates">
                  Candidates{" "}
                  <span className="ml-1.5 tabular-nums text-muted-foreground">{skillCandidates.length}</span>
                </TabsTrigger>
              </Identified>
              <Identified as="PlanningTabsTriggerProtoSkills">
                <TabsTrigger value="proto-skills">
                  Proto-skills{" "}
                  <span className="ml-1.5 tabular-nums text-muted-foreground">{protoSkills.length}</span>
                </TabsTrigger>
              </Identified>
              <Identified as="PlanningTabsTriggerWorkflows">
                <TabsTrigger value="workflows">
                  Workflows{" "}
                  <span className="ml-1.5 tabular-nums text-muted-foreground">{WORKFLOWS_DATA.length}</span>
                </TabsTrigger>
              </Identified>
            </TabsList>
          </Identified>

          <TabsContent value="system">
            <Identified as="PlanningTabSystem">
              <div className="space-y-6">
                {selfEvalLatest ? (
                  <PlanningSystemTab selfEval={selfEvalLatest} />
                ) : (
                  <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                    Loading system telemetry...
                  </div>
                )}
              </div>
            </Identified>
          </TabsContent>

          <TabsContent value="planning">
            <Identified as="PlanningTabPlanning">
              <Tabs defaultValue={planningInnerDefault}>
                <Identified as="PlanningInnerTabsList" className="mb-6">
                  <TabsList className="flex-wrap">
                    <Identified as="PlanningInnerTabsTriggerPhases">
                      <TabsTrigger value="phases">
                        Phases <span className="ml-1.5 tabular-nums text-muted-foreground">{allPhases.length}</span>
                      </TabsTrigger>
                    </Identified>
                    <Identified as="PlanningInnerTabsTriggerTasks">
                      <TabsTrigger value="tasks">
                        Tasks <span className="ml-1.5 tabular-nums text-muted-foreground">{allTasks.length}</span>
                      </TabsTrigger>
                    </Identified>
                    <Identified as="PlanningInnerTabsTriggerDecisions">
                      <TabsTrigger value="decisions">
                        Decisions <span className="ml-1.5 tabular-nums text-muted-foreground">{allDecisions.length}</span>
                      </TabsTrigger>
                    </Identified>
                    <Identified as="PlanningInnerTabsTriggerRoadmap">
                      <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
                    </Identified>
                    <Identified as="PlanningInnerTabsTriggerRequirements">
                      <TabsTrigger value="requirements">
                        Requirements <span className="ml-1.5 tabular-nums text-muted-foreground">{versions.length}</span>
                      </TabsTrigger>
                    </Identified>
                  </TabsList>
                </Identified>

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
              </Tabs>
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
              <PlanningWorkflowsTab
                workflows={WORKFLOWS_DATA}
                signal={signal}
                humanWorkflows={humanWorkflows}
              />
            </Identified>
          </TabsContent>
        </Tabs>
      </Identified>
    </SiteSection>
  );
}
