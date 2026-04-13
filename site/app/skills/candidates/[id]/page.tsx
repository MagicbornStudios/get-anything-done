import { notFound } from "next/navigation";
import DetailShell from "@/components/detail/DetailShell";
import selfEvalData from "@/data/self-eval.json";
import { SkillCandidateDetailSidebar } from "./SkillCandidateDetailSidebar";
import type { SkillCandidateDetail } from "./skill-candidate-detail-types";

const CANDIDATES = (selfEvalData.latest?.skill_candidates ?? []) as SkillCandidateDetail[];

export const dynamicParams = false;

export function generateStaticParams() {
  return CANDIDATES.map((c) => ({ id: c.name }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = CANDIDATES.find((x) => x.name === id);
  if (!c) return { title: "Skill candidate not found" };
  return {
    title: `${c.source_phase_title} — skill candidate`,
    description: `Auto-drafted skill candidate from phase ${c.source_phase}, pressure score ${c.pressure_score}.`,
  };
}

export default async function SkillCandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = CANDIDATES.find((x) => x.name === id);
  if (!c) notFound();

  const isReviewed = c.reviewed !== false;

  return (
    <DetailShell
      kind="skill"
      backHref="/planning"
      backLabel="Back to planning"
      name={c.source_phase_title}
      subtitle={`skill-candidate/${c.name}`}
      description={`Auto-drafted candidate from phase ${c.source_phase}. Pressure ${c.pressure_score} (threshold 10). Quarantined from GAD catalog until reviewed.`}
      badges={[
        { label: "System", variant: "outline" },
        { label: `pressure ${c.pressure_score}`, variant: "default" },
        ...(isReviewed ? [{ label: String(c.reviewed), variant: "success" as const }] : []),
      ]}
      meta={[
        { label: "Tasks", value: `${c.tasks_done}/${c.tasks_total}` },
        { label: "Crosscuts", value: String(c.crosscuts) },
        { label: "Phase", value: c.source_phase },
      ]}
      sourcePath={c.file_path}
      bodyHtml={c.body_html ?? ""}
      sidebar={<SkillCandidateDetailSidebar c={c} />}
    />
  );
}
