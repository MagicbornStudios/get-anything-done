"use client";

import type { DevIdComponentTag } from "./SectionRegistry";
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
