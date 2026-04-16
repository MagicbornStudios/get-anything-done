"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import { EditableField } from "./EditableField";

/**
 * Recipes tab — CRUD for reusable species templates.
 *
 * Recipes live at evals/<project>/recipes/<slug>/recipe.json.
 * "Apply" creates a new species from the recipe template.
 *
 * VCS cids:
 *   project-editor-recipes-tab-site-section
 *   recipe-card-<slug>-site-section
 *   recipe-create-form-site-section
 */

type Recipe = {
  slug: string;
  name: string;
  description: string;
  workflow: string | null;
  constraints: Record<string, unknown>;
  installedSkills: string[];
  trace: boolean;
  createdAt: string;
  updatedAt: string;
};

function useRecipes(projectId: string) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/dev/evals/projects/${projectId}/recipes`);
      if (!res.ok) return;
      const data = await res.json();
      setRecipes(data.recipes ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { recipes, loading, refresh };
}

function RecipeCreateForm({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dev/evals/projects/${projectId}/recipes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim() || slug.trim(),
          workflow: workflow.trim() || null,
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create recipe");
        return;
      }
      setSlug("");
      setName("");
      setWorkflow("");
      setDescription("");
      setOpen(false);
      onCreated();
    } finally {
      setSaving(false);
    }
  }, [projectId, slug, name, workflow, description, onCreated]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded border border-dashed border-border/40 py-1.5 text-[10px] text-muted-foreground/60 hover:border-accent/40 hover:text-accent transition-colors"
      >
        + Create Recipe
      </button>
    );
  }

  return (
    <SiteSection
      cid="recipe-create-form-site-section"
      sectionShell={false}
      className="rounded-lg border border-accent/30 bg-card/20"
      allowContextPanel={false}
    >
      <form onSubmit={handleSubmit} className="p-3 flex flex-col gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-accent">
          New Recipe
        </h3>
        <input
          type="text"
          placeholder="slug (kebab-case)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded border border-border/40 bg-background px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none font-mono"
          required
        />
        <input
          type="text"
          placeholder="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-border/40 bg-background px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
        />
        <select
          value={workflow}
          onChange={(e) => setWorkflow(e.target.value)}
          className="w-full rounded border border-border/40 bg-background px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none"
        >
          <option value="">Workflow (optional)</option>
          <option value="gad">gad</option>
          <option value="bare">bare</option>
          <option value="emergent">emergent</option>
        </select>
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded border border-border/40 bg-background px-2 py-1 text-xs text-foreground focus:border-accent focus:outline-none resize-y"
        />
        {error && (
          <p className="text-[10px] text-red-400">{error}</p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null); }}
            className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !slug.trim()}
            className={cn(
              "rounded bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/30",
              saving && "opacity-50",
            )}
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </SiteSection>
  );
}

function ApplyDialog({
  projectId,
  recipeSlug,
  onApplied,
  onClose,
}: {
  projectId: string;
  recipeSlug: string;
  onApplied: () => void;
  onClose: () => void;
}) {
  const [speciesName, setSpeciesName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!speciesName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dev/evals/projects/${projectId}/recipes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          recipe: recipeSlug,
          speciesName: speciesName.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to apply recipe");
        return;
      }
      setSpeciesName("");
      onApplied();
      onClose();
    } finally {
      setSaving(false);
    }
  }, [projectId, recipeSlug, speciesName, onApplied, onClose]);

  return (
    <form onSubmit={handleApply} className="mt-2 flex flex-col gap-1.5 border-t border-border/20 pt-2">
      <label className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
        New species name
      </label>
      <input
        type="text"
        placeholder="species-name (kebab-case)"
        value={speciesName}
        onChange={(e) => setSpeciesName(e.target.value)}
        className="w-full rounded border border-border/40 bg-background px-2 py-0.5 text-[11px] font-mono text-foreground focus:border-accent focus:outline-none"
        required
      />
      {error && <p className="text-[9px] text-red-400">{error}</p>}
      <div className="flex gap-1.5 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !speciesName.trim()}
          className={cn(
            "rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400 hover:bg-emerald-500/30",
            saving && "opacity-50",
          )}
        >
          {saving ? "Applying..." : "Apply"}
        </button>
      </div>
    </form>
  );
}

function RecipeCard({
  recipe,
  projectId,
  onUpdated,
  onDeleted,
}: {
  recipe: Recipe;
  projectId: string;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [applying, setApplying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const constraintCount = useMemo(
    () => (recipe.constraints ? Object.keys(recipe.constraints).length : 0),
    [recipe.constraints],
  );

  const handleFieldSave = useCallback(
    async (field: string, value: string) => {
      await fetch(`/api/dev/evals/projects/${projectId}/recipes`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: recipe.slug, [field]: value }),
      });
      onUpdated();
    },
    [projectId, recipe.slug, onUpdated],
  );

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await fetch(`/api/dev/evals/projects/${projectId}/recipes`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: recipe.slug }),
      });
      onDeleted();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [projectId, recipe.slug, onDeleted]);

  return (
    <SiteSection
      cid={`recipe-card-${recipe.slug}-site-section` as const}
      sectionShell={false}
      className="rounded-lg border border-border/40 hover:border-border/60 transition-colors"
      allowContextPanel={false}
    >
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold">{recipe.name}</h3>
          <span className="text-[10px] font-mono text-muted-foreground/60">
            {recipe.slug}
          </span>
        </div>

        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <EditableField
            label="Description"
            value={recipe.description || null}
            onSave={(v) => handleFieldSave("description", v)}
            placeholder="--"
          />
          <EditableField
            label="Workflow"
            value={recipe.workflow}
            onSave={(v) => handleFieldSave("workflow", v)}
            mono
            placeholder="--"
          />
          <div>
            <dt className="text-muted-foreground/50">Constraints</dt>
            <dd className="font-mono">{constraintCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground/50">Skills</dt>
            <dd className="font-mono">{recipe.installedSkills?.length ?? 0}</dd>
          </div>
        </dl>

        <div className="mt-2 flex gap-1.5 items-center">
          {recipe.trace && (
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
              trace
            </span>
          )}
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => setApplying(!applying)}
              className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-medium text-blue-400 hover:bg-blue-500/20"
            >
              Apply
            </button>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-medium text-red-400 hover:bg-red-500/20"
              >
                Delete
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  "rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-medium text-red-300",
                  deleting && "opacity-50",
                )}
              >
                {deleting ? "..." : "Confirm"}
              </button>
            )}
          </div>
        </div>

        {applying && (
          <ApplyDialog
            projectId={projectId}
            recipeSlug={recipe.slug}
            onApplied={onUpdated}
            onClose={() => setApplying(false)}
          />
        )}
      </div>
    </SiteSection>
  );
}

export function RecipesTab({
  projectId,
}: {
  projectId: string;
}) {
  const { recipes, loading, refresh } = useRecipes(projectId);

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

        {loading && (
          <p className="text-[10px] text-muted-foreground/40 py-2">Loading...</p>
        )}

        {recipes.map((r) => (
          <RecipeCard
            key={r.slug}
            recipe={r}
            projectId={projectId}
            onUpdated={refresh}
            onDeleted={refresh}
          />
        ))}

        {!loading && recipes.length === 0 && (
          <p className="text-[10px] text-muted-foreground/40 py-2">
            No recipes defined
          </p>
        )}

        <RecipeCreateForm projectId={projectId} onCreated={refresh} />
      </div>
    </SiteSection>
  );
}
