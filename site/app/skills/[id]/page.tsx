import { notFound } from "next/navigation";
import DetailShell from "@/components/detail/DetailShell";
import { SKILLS, SKILL_INHERITANCE, COMMANDS } from "@/lib/catalog.generated";
import { getAuthoredByRuns } from "./skill-detail-shared";
import SkillDetailCopyCard from "./SkillDetailCopyCard";
import SkillDetailAuthoredByRunsCard from "./SkillDetailAuthoredByRunsCard";
import SkillDetailInheritanceCard from "./SkillDetailInheritanceCard";
import SkillDetailRelatedCommandsCard from "./SkillDetailRelatedCommandsCard";
import SkillDetailSidebarBackLink from "./SkillDetailSidebarBackLink";

export const dynamicParams = false;

export function generateStaticParams() {
  return SKILLS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const skill = SKILLS.find((s) => s.id === id);
  if (!skill) return { title: "Skill not found" };
  return {
    title: `${skill.name} — GAD skill`,
    description: skill.description,
  };
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const skill = SKILLS.find((s) => s.id === id);
  if (!skill) notFound();

  const inheritedBy = SKILL_INHERITANCE[skill.id] ?? [];
  const relatedCommands = COMMANDS.filter((c) => c.id === skill.id || c.id.includes(skill.id));
  const authoredByRuns = getAuthoredByRuns(skill.id);

  const sidebar = (
    <>
      <SkillDetailCopyCard bodyRaw={skill.bodyRaw} />
      {authoredByRuns.length > 0 && (
        <SkillDetailAuthoredByRunsCard runs={authoredByRuns} />
      )}
      <SkillDetailInheritanceCard inheritedBy={inheritedBy} />
      {relatedCommands.length > 0 && (
        <SkillDetailRelatedCommandsCard commands={relatedCommands} />
      )}
      <SkillDetailSidebarBackLink />
    </>
  );

  return (
    <DetailShell
      kind="skill"
      backHref="/skills"
      backLabel="Back to skills"
      name={skill.name}
      subtitle={skill.id}
      description={skill.description}
      sourcePath={skill.file}
      bodyHtml={skill.bodyHtml}
      sidebar={sidebar}
    />
  );
}
