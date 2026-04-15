import { AgentHandoffCycleCopy } from "@/components/landing/agent-handoff-cycle/AgentHandoffCycleCopy";
import { AgentHandoffCycleDiagram } from "@/components/landing/agent-handoff-cycle/AgentHandoffCycleDiagram";
import { AgentHandoffCycleMedia } from "@/components/landing/agent-handoff-cycle/AgentHandoffCycleMedia";
import { Identified } from "@/components/devid/Identified";
import { SiteSection } from "@/components/site";

export default function AgentHandoffCycle() {
  return (
    <SiteSection
      id="agent-handoff-cycle"
      cid="agent-handoff-cycle-site-section"
      tone="muted"
      className="border-t border-border/60"
    >
      <Identified as="LandingAgentHandoffCycle">
        <AgentHandoffCycleDiagram />
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)] lg:items-start lg:gap-16">
          <Identified as="AgentHandoffCycleCopy">
            <AgentHandoffCycleCopy />
          </Identified>
          <Identified as="AgentHandoffCycleMedia">
            <AgentHandoffCycleMedia />
          </Identified>
        </div>
      </Identified>
    </SiteSection>
  );
}
