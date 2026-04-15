"use client";

import type { DevIdComponentTag } from "./SectionRegistry";

const BLOCK_LABEL_MAX = 72;
const BLOCK_CID_MAX = 56;

function truncateForPrompt(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  if (maxChars <= 1) return "...";
  return `${value.slice(0, maxChars - 1)}...`;
}

/** Escape for use inside double-quoted HTML-like attributes in markdown inline code. */
function escapeAttrInCode(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/`/g, "\\`");
}

export type HandoffComponentTag = DevIdComponentTag;
export type PromptVerbosity = "full" | "compact";
export const VISUAL_CONTEXT_SKILL_REF = "vendor/get-anything-done/skills/gad-visual-context-system/SKILL.md";

export const DEFAULT_UPDATE_TEMPLATE = `Objective: update target component.
Route: **{{PAGE_URL}}**
Skill ref (mandatory): {{VISUAL_CONTEXT_SKILL_REF}}

Target:
- wrapper: {{COMPONENT_TAG}}
- as: {{LABEL}}
- search: {{SEARCH_LITERAL}}
- data-cid: {{CID}}
- scope: target node + children

Execution model:
- Default: subagent.
- Subagent scope: target component plus tightly related nearby components in the same UI context.
- If work expands beyond local UI context, keep orchestration in main session and delegate isolated slices only.

Report:
- workflow: subagent | local-session
- rationale: one line
- preserve route/as/search/data-cid

Tasking (update):
`;

export const DEFAULT_DELETE_TEMPLATE = `Objective: remove target component.
Route: **{{PAGE_URL}}**
Skill ref (mandatory): {{VISUAL_CONTEXT_SKILL_REF}}

Target:
- wrapper: {{COMPONENT_TAG}}
- as: {{LABEL}}
- search: {{SEARCH_LITERAL}}
- data-cid: {{CID}}
- scope: target node + children

Execution model:
- Default: subagent.
- Subagent scope: target component plus tightly related nearby components in the same UI context.

Report:
- workflow: subagent
- rationale: one line
- preserve route/as/search/data-cid

Tasking (delete):
1. Remove dead imports/components.
2. Typecheck touched package.`;

export const COMPACT_UPDATE_TEMPLATE = `Update target.
Route: {{PAGE_URL}}
Target: {{COMPONENT_TAG}} | {{LABEL}}
search: {{SEARCH_LITERAL}}
data-cid: {{CID}}
`;

export const COMPACT_DELETE_TEMPLATE = `Delete target.
Route: {{PAGE_URL}}
Target: {{COMPONENT_TAG}} | {{LABEL}}
search: {{SEARCH_LITERAL}}
data-cid: {{CID}}
Cleanup: remove dead imports/components; typecheck touched package.`;

function renderPromptTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

/** Locked update header (read-only); copy is this plus a newline plus the user editor body. */
export function buildUpdateLockedPrefix(
  pageUrl: string,
  label: string,
  cid: string,
  componentTag: HandoffComponentTag,
  searchHint?: string,
  templateText?: string,
  verbosity: PromptVerbosity = "full",
): string {
  const labelShort = truncateForPrompt(label, BLOCK_LABEL_MAX);
  const cidShort = truncateForPrompt(cid, BLOCK_CID_MAX);
  const searchShort = truncateForPrompt(searchHint ?? cid, Math.max(BLOCK_LABEL_MAX, BLOCK_CID_MAX));
  const fallbackTemplate = verbosity === "compact" ? COMPACT_UPDATE_TEMPLATE : DEFAULT_UPDATE_TEMPLATE;
  return renderPromptTemplate(templateText || fallbackTemplate, {
    PAGE_URL: pageUrl,
    COMPONENT_TAG: componentTag,
    LABEL: escapeAttrInCode(labelShort),
    SEARCH_LITERAL: escapeAttrInCode(searchShort),
    CID: escapeAttrInCode(cidShort),
    VISUAL_CONTEXT_SKILL_REF,
  });
}

export function buildDeletePrompt(
  pageUrl: string,
  label: string,
  cid: string,
  componentTag: HandoffComponentTag,
  searchHint?: string,
  templateText?: string,
  verbosity: PromptVerbosity = "full",
) {
  const labelShort = truncateForPrompt(label, BLOCK_LABEL_MAX);
  const cidShort = truncateForPrompt(cid, BLOCK_CID_MAX);
  const searchShort = truncateForPrompt(searchHint ?? cid, Math.max(BLOCK_LABEL_MAX, BLOCK_CID_MAX));
  const fallbackTemplate = verbosity === "compact" ? COMPACT_DELETE_TEMPLATE : DEFAULT_DELETE_TEMPLATE;
  return renderPromptTemplate(templateText || fallbackTemplate, {
    PAGE_URL: pageUrl,
    COMPONENT_TAG: componentTag,
    LABEL: escapeAttrInCode(labelShort),
    SEARCH_LITERAL: escapeAttrInCode(searchShort),
    CID: escapeAttrInCode(cidShort),
    VISUAL_CONTEXT_SKILL_REF,
  });
}
