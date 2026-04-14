import { ShieldAlert } from "lucide-react";
import { SiteSection, SiteSectionHeading } from "@/components/site";
import { SecurityAttackCard } from "./SecurityAttackCard";

export function SecurityAttackSurfacesSection() {
  return (
    <SiteSection cid="security-attack-surfaces-section-site-section" tone="muted">
      <SiteSectionHeading
        icon={ShieldAlert}
        kicker="Attack surfaces"
        kickerRowClassName="mb-6 gap-3"
        iconClassName="text-rose-400"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SecurityAttackCard
          title="Prompt injection via skill body"
          severity="high"
          description="A malicious skill includes instructions that tell the agent to ignore the user, exfiltrate credentials, or commit a backdoor. Because skills are loaded into the agent's context as trusted text, there is no runtime boundary between user request and skill instruction."
          mitigation="Only load skills from trusted sources. Read the SKILL.md body before inheriting it. Per Anthropic's skills guide (gad-70), frontmatter forbids XML angle brackets to reduce injection risk; GAD follows the same rule."
        />
        <SecurityAttackCard
          title="Typosquatting"
          severity="high"
          description="An attacker publishes a skill with a name that looks like a legitimate one: createskill instead of create-skill, or a lookalike Unicode character. A developer copying install instructions from a forum pulls the malicious version by mistake."
          mitigation="GAD's skill format requires kebab-case-only names and reserves claude and anthropic as forbidden prefixes. Fuzzy-name-collision detection is queued as a future skills-directory feature. For now, paste skill names from sources you trust."
          examples={["reactt", "lodahs", "zustand.js", "gooogle.com", "facebok.com"]}
        />
        <SecurityAttackCard
          title="Postinstall hook abuse"
          severity="high"
          description="A skill that ships with a setup script can run arbitrary code on install. This is the classic supply-chain vector."
          mitigation="GAD skills do not ship with postinstall scripts. If a third-party skill does, treat it as executable code and review it before installation."
        />
        <SecurityAttackCard
          title="Credential exfiltration"
          severity="critical"
          description="A skill that needs API keys for an MCP server, CI integration, or cloud service can misuse those credentials by uploading them elsewhere, spinning resources, or poisoning a service account."
          mitigation="Skills that require credentials must declare it in frontmatter. Review what the skill does with secrets before adding them to your environment. GAD eval runs should use scoped, low-privilege tokens."
        />
        <SecurityAttackCard
          title="Silent tool-use expansion"
          severity="medium"
          description="A skill that was authored to do X quietly starts doing Y after an update. Without version pinning or a change-tracking story, the user trusts the skill based on its original purpose but gets something different."
          mitigation="GAD tracks skill evolution with changelogs and trace data. That is an audit trail, not a sandbox. You still need provenance and review."
        />
        <SecurityAttackCard
          title="Over-triggering on unrelated tasks"
          severity="low"
          description="A skill with an overly broad description loads on tasks it should not, consuming context budget and potentially misleading the agent."
          mitigation="This is a reliability problem more than a direct exploit. Trigger coverage and collision scans are the long-term mitigation path."
        />
      </div>
    </SiteSection>
  );
}

