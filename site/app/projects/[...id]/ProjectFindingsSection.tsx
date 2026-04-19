import { FINDINGS, type Finding } from "@/lib/catalog.generated";
import { ProjectFindingArticle } from "./ProjectFindingArticle";
import { SiteSection } from "@/components/site";

export function ProjectFindingsSection({ projectId }: { projectId: string }) {
  const findings: Finding[] = FINDINGS.filter((f) =>
    Array.isArray(f.projects) && f.projects.includes(projectId),
  ).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  if (findings.length === 0) return null;

  // Task 44-16: SiteSection cid is the searchable handle; the outer
  // Identified wrapper that just restated "ProjectFindings" was removed.
  return (
    <SiteSection id="findings" cid="findings-site-section" className="border-t border-border/60">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Findings</h2>
      <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
        Per-round writeups that reference this project. Each finding is stamped with the GAD
        version it was observed under, so comparisons across versions stay honest.
      </p>

      <div className="mt-8 space-y-6">
        {findings.map((f) => (
          <ProjectFindingArticle key={f.slug} finding={f} />
        ))}
      </div>
    </SiteSection>
  );
}

