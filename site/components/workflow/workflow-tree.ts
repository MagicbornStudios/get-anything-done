import type { Workflow } from "@/lib/catalog.generated";

/**
 * Build a nesting tree from a flat WORKFLOWS catalog.
 * Workflows declare their parent via frontmatter `parent-workflow: <slug>`.
 * Returns the roots (workflows with no parent) with `children` populated recursively.
 */
export interface WorkflowNode {
  workflow: Workflow;
  children: WorkflowNode[];
}

export function buildWorkflowTree(workflows: readonly Workflow[]): WorkflowNode[] {
  const bySlug = new Map<string, WorkflowNode>();
  for (const w of workflows) {
    bySlug.set(w.slug, { workflow: w, children: [] });
  }
  const roots: WorkflowNode[] = [];
  for (const w of workflows) {
    const node = bySlug.get(w.slug)!;
    const parentSlug = w.parentWorkflow;
    if (parentSlug && bySlug.has(parentSlug)) {
      bySlug.get(parentSlug)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** Partition workflows by origin for the three-section layout. */
export function partitionWorkflows(workflows: readonly Workflow[]) {
  const authored: Workflow[] = [];
  const emergent: Workflow[] = [];
  for (const w of workflows) {
    if (w.origin === "emergent") emergent.push(w);
    else authored.push(w);
  }
  return { authored, emergent };
}
