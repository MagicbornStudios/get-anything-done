"use client";

import { useMemo } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import type { EvalProjectMeta } from "@/lib/eval-data";

/**
 * Recipes tab — reusable species templates owned by the project.
 * Shows each species' template config: framework, constraints,
 * scoring weights, build requirement.
 *
 * VCS cids:
 *   project-editor-recipes-tab-site-section
 *   // cid prototype: recipe-card-<species>-site-section
 */

type RecipeSummary = {
  species: string;
  framework: string | null;
  domain: string | null;
  techStack: string | null;
  buildRequirement: string | null;
  constraintCount: number;
  weightCount: number;
  hasRubric: boolean;
};

function summarizeRecipes(allProjects: EvalProjectMeta[]): RecipeSummary[] {
  return allProjects.map((sp) => ({
    species: sp.species ?? sp.workflow ?? "default",
    framework: sp.contextFramework ?? sp.workflow,
    domain: sp.domain,
    techStack: sp.techStack,
    buildRequirement: sp.buildRequirement,
    constraintCount: sp.constraints ? Object.keys(sp.constraints).length : 0,
    weightCount: sp.scoringWeights ? Object.keys(sp.scoringWeights).length : 0,
    hasRubric: sp.humanReviewRubric != null,
  }));
}

function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  return (
    // cid prototype: recipe-card-<species>-site-section
    <SiteSection
      cid={`recipe-card-${recipe.species}-site-section` as const}
      sectionShell={false}
      className="rounded-lg border border-border/40 hover:border-border/60 hover:bg-card/30 transition-colors"
      allowContextPanel={false}
    >
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold">{recipe.species}</h3>
          <span className="text-[10px] font-mono text-muted-foreground/60">
            {recipe.framework ?? "none"}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <div>
            <span className="text-muted-foreground/50">Domain</span>
            <p className="font-mono">{recipe.domain ?? "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground/50">Stack</span>
            <p className="font-mono">{recipe.techStack ?? "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground/50">Constraints</span>
            <p className="font-mono">{recipe.constraintCount}</p>
          </div>
          <div>
            <span className="text-muted-foreground/50">Weights</span>
            <p className="font-mono">{recipe.weightCount}</p>
          </div>
        </div>

        <div className="mt-2 flex gap-1.5">
          {recipe.hasRubric && (
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
              rubric
            </span>
          )}
          {recipe.buildRequirement && (
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-medium text-blue-400 truncate max-w-[120px]">
              {recipe.buildRequirement}
            </span>
          )}
        </div>
      </div>
    </SiteSection>
  );
}

export function RecipesTab({
  allProjects,
}: {
  allProjects: EvalProjectMeta[];
}) {
  const recipes = useMemo(() => summarizeRecipes(allProjects), [allProjects]);

  return (
    <SiteSection
      cid="project-editor-recipes-tab-site-section"
      sectionShell={false}
      className="border-b-0"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recipes
          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground/60">
            ({recipes.length})
          </span>
        </h2>

        {recipes.map((r) => (
          <RecipeCard key={r.species} recipe={r} />
        ))}

        {recipes.length === 0 && (
          <p className="text-[10px] text-muted-foreground/40 py-2">
            No recipes defined
          </p>
        )}
      </div>
    </SiteSection>
  );
}
