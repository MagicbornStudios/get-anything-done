"use client";

import type { DevIdComponentTag, RegistryEntry } from "./SectionRegistry";
import {
  DEVID_DELETE_COMPACT_TEMPLATE,
  DEVID_DELETE_TEMPLATE,
  DEVID_UPDATE_COMPACT_TEMPLATE,
  DEVID_UPDATE_TEMPLATE,
} from "@/lib/devid-prompts.generated";

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

export const DEFAULT_UPDATE_TEMPLATE = DEVID_UPDATE_TEMPLATE;
export const DEFAULT_DELETE_TEMPLATE = DEVID_DELETE_TEMPLATE;
export const COMPACT_UPDATE_TEMPLATE = DEVID_UPDATE_COMPACT_TEMPLATE;
export const COMPACT_DELETE_TEMPLATE = DEVID_DELETE_COMPACT_TEMPLATE;

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

/** Extra targets block when 2+ landmarks are merged at the same depth (appended after primary template). */
export function formatMergedTargetsAppendix(entries: RegistryEntry[], verbosity: PromptVerbosity): string {
  const extra = entries.slice(1);
  if (extra.length === 0) return "";
  const depth = entries[0]?.depth ?? 0;
  if (verbosity === "compact") {
    const lines = extra.map(
      (e, i) =>
        `  ${i + 2}. ${truncateForPrompt(e.label, BLOCK_LABEL_MAX)} | ${truncateForPrompt(e.searchHint ?? e.cid, Math.max(BLOCK_LABEL_MAX, BLOCK_CID_MAX))}`,
    );
    return `\n\nAdditional merged targets (depth ${depth}):\n${lines.join("\n")}\n`;
  }
  const lines = extra.map((e, i) => {
    const tag = e.componentTag ?? "Identified";
    const lab = truncateForPrompt(e.label, BLOCK_LABEL_MAX);
    const cidS = truncateForPrompt(e.cid, BLOCK_CID_MAX);
    const searchS = truncateForPrompt(e.searchHint ?? e.cid, Math.max(BLOCK_LABEL_MAX, BLOCK_CID_MAX));
    return `  ${i + 2}. wrapper: ${tag}\n     as: ${lab}\n     search: ${escapeAttrInCode(searchS)}\n     data-cid: ${escapeAttrInCode(cidS)}`;
  });
  return `\n\nAdditional merged targets (same nesting depth ${depth}; coordinate with primary target above):\n${lines.join("\n\n")}\n`;
}

/** Locked update prefix for primary + optional same-depth merge list (order = \`entries\`). */
export function buildUpdateLockedPrefixMerged(
  pageUrl: string,
  entries: RegistryEntry[],
  verbosity: PromptVerbosity = "full",
): string {
  if (entries.length === 0) return "";
  const primary = entries[0];
  const base = buildUpdateLockedPrefix(
    pageUrl,
    primary.label,
    primary.cid,
    primary.componentTag ?? "Identified",
    primary.searchHint,
    undefined,
    verbosity,
  );
  return base + formatMergedTargetsAppendix(entries, verbosity);
}

export function buildDeletePromptMerged(
  pageUrl: string,
  entries: RegistryEntry[],
  verbosity: PromptVerbosity = "full",
): string {
  if (entries.length === 0) return "";
  const primary = entries[0];
  const base = buildDeletePrompt(
    pageUrl,
    primary.label,
    primary.cid,
    primary.componentTag ?? "Identified",
    primary.searchHint,
    undefined,
    verbosity,
  );
  return base + formatMergedTargetsAppendix(entries, verbosity);
}
