"use client";

import { Identified } from "@/components/devid/Identified";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillsAgentsTab } from "./SkillsAgentsTab";
import { SkillsCatalogTab } from "./SkillsCatalogTab";
import { SkillsUsageTab } from "./SkillsUsageTab";
import type { AgentUsageDTO, SkillSummaryDTO, SkillUsageDTO } from "./skills-page-types";

export function SkillsPageTabs({
  summaries,
  usage,
  agents,
}: {
  summaries: SkillSummaryDTO[];
  usage: SkillUsageDTO[];
  agents: AgentUsageDTO[];
}) {
  return (
    <Tabs defaultValue="catalog" className="w-full">
      <Identified as="SkillsPageTabsList">
        <TabsList className="flex w-full max-w-xl flex-wrap justify-start gap-1 bg-card/40">
          <TabsTrigger value="catalog">
            Catalog <span className="ml-1.5 text-muted-foreground/70">{summaries.length}</span>
          </TabsTrigger>
          <TabsTrigger value="usage">
            Usage <span className="ml-1.5 text-muted-foreground/70">{usage.length}</span>
          </TabsTrigger>
          <TabsTrigger value="agents">
            Agents <span className="ml-1.5 text-muted-foreground/70">{agents.length}</span>
          </TabsTrigger>
        </TabsList>
      </Identified>

      <TabsContent value="catalog" className="mt-6">
        <Identified as="SkillsCatalogTab">
          <SkillsCatalogTab summaries={summaries} />
        </Identified>
      </TabsContent>

      <TabsContent value="usage" className="mt-6">
        <Identified as="SkillsUsageTab">
          <SkillsUsageTab usage={usage} />
        </Identified>
      </TabsContent>

      <TabsContent value="agents" className="mt-6">
        <Identified as="SkillsAgentsTab">
          <SkillsAgentsTab agents={agents} />
        </Identified>
      </TabsContent>
    </Tabs>
  );
}
