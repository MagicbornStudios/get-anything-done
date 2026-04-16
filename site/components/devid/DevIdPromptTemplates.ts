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

/** Compact templates omit `{{VISUAL_CONTEXT_SKILL_REF}}`; full templates include it. Never duplicate. */
function ensureVcSkillRefLine(head: string): string {
  if (head.includes(VISUAL_CONTEXT_SKILL_REF)) return head;
  return `${head.trimEnd()}\nSkill ref (mandatory): ${VISUAL_CONTEXT_SKILL_REF}`;
}

/** Start of `Target` / `Target(s)` section in bundled VC templates (before Execution / workflow). */
function findTargetsSectionIndex(normalized: string): number {
  const a = normalized.indexOf("\n\nTarget(s):");
  if (a >= 0) return a;
  return normalized.indexOf("\n\nTarget:");
}

/** Full template: header ends before Target block; tail starts at Execution model. */
function splitFullVcTemplate(template: string): { head: string; tail: string } | null {
  const n = template.replace(/\r\n/g, "\n");
  const ti = findTargetsSectionIndex(n);
  const ei = n.indexOf("\n\nExecution model:");
  if (ti < 0 || ei < 0 || ei <= ti) return null;
  return { head: n.slice(0, ti), tail: n.slice(ei) };
}

/** Compact template: head ends before `\\nTarget:`; tail starts at `<workflow`. */
function splitCompactVcTemplate(template: string): { head: string; tail: string } | null {
  const n = template.replace(/\r\n/g, "\n");
  const ti = n.indexOf("\nTarget:");
  const wi = n.indexOf("<workflow");
  if (ti < 0 || wi < 0 || wi <= ti) return null;
  return { head: n.slice(0, ti), tail: n.slice(wi) };
}

function formatEntryLineConcise(e: RegistryEntry): string {
  const tag = e.componentTag ?? "Identified";
  const lab = truncateForPrompt(e.label, BLOCK_LABEL_MAX);
  const searchS = truncateForPrompt(e.searchHint ?? e.cid, Math.max(BLOCK_LABEL_MAX, BLOCK_CID_MAX));
  const cidS = truncateForPrompt(e.cid, BLOCK_CID_MAX);
  const se = escapeAttrInCode(searchS);
  const ce = escapeAttrInCode(cidS);
  if (tag === "Identified") {
    return `- ${lab} · search ${se} · data-cid ${ce}`;
  }
  return `- ${tag} · ${lab} · search ${se} · data-cid ${ce}`;
}

/**
 * All handoff targets (Alt + Ctrl) directly under Objective / Route / Skill, before Execution / workflow.
 * Omits repeated `wrapper: Identified` lines — one concise line per landmark.
 */
function formatDualLaneTargetsBlock(
  altEntries: RegistryEntry[],
  ctrlEntries: RegistryEntry[],
  verbosity: PromptVerbosity,
): string {
  const total = altEntries.length + ctrlEntries.length;
  if (total === 0) return "";

  if (verbosity === "compact") {
    const parts: string[] = [];
    if (altEntries.length) {
      parts.push(
        `Alt: ${altEntries.map((e) => `${truncateForPrompt(e.label, 36)}|${truncateForPrompt(e.searchHint ?? e.cid, 44)}`).join("; ")}`,
      );
    }
    if (ctrlEntries.length) {
      parts.push(
        `Ctrl: ${ctrlEntries.map((e) => `${truncateForPrompt(e.label, 36)}|${truncateForPrompt(e.searchHint ?? e.cid, 44)}`).join("; ")}`,
      );
    }
    return `\n\nTarget(s): ${parts.join(" · ")}\n`;
  }

  const lines: string[] = ["Target(s):"];
  if (altEntries.length) {
    const d = altEntries[0]?.depth;
    const dNote = d != null ? ` · depth ${d}` : "";
    lines.push(`- **Alt** (same-depth handoff${dNote}):`);
    for (const e of altEntries) lines.push(`  ${formatEntryLineConcise(e)}`);
  }
  if (ctrlEntries.length) {
    lines.push(`- **Ctrl/Cmd** (cross-depth reference):`);
    for (const e of ctrlEntries) lines.push(`  ${formatEntryLineConcise(e)}`);
  }
  lines.push(`- scope: each listed landmark + children`);
  return `\n\n${lines.join("\n")}\n`;
}

function applyPluralObjectiveHead(head: string, mode: "update" | "delete", multi: boolean): string {
  if (!multi) return head;
  if (mode === "update") {
    return head
      .replace(/^Objective: update target component\./m, "Objective: update target component(s).")
      .replace(/^Update target\.$/m, "Update target(s).");
  }
  return head
    .replace(/^Objective: remove target component\./m, "Objective: remove target component(s).")
    .replace(/^Delete target\.$/m, "Delete target(s).");
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
  const rendered = renderPromptTemplate(templateText || fallbackTemplate, {
    PAGE_URL: pageUrl,
    COMPONENT_TAG: componentTag,
    LABEL: escapeAttrInCode(labelShort),
    SEARCH_LITERAL: escapeAttrInCode(searchShort),
    CID: escapeAttrInCode(cidShort),
    VISUAL_CONTEXT_SKILL_REF,
  });
  return verbosity === "compact" ? ensureVcSkillRefLine(rendered) : rendered;
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
  const rendered = renderPromptTemplate(templateText || fallbackTemplate, {
    PAGE_URL: pageUrl,
    COMPONENT_TAG: componentTag,
    LABEL: escapeAttrInCode(labelShort),
    SEARCH_LITERAL: escapeAttrInCode(searchShort),
    CID: escapeAttrInCode(cidShort),
    VISUAL_CONTEXT_SKILL_REF,
  });
  return verbosity === "compact" ? ensureVcSkillRefLine(rendered) : rendered;
}

/** @deprecated Inline dual-lane block lists all Alt targets; use buildUpdateLockedPrefixMerged. */
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

/** @deprecated Use buildUpdateLockedPrefixMerged / buildDeletePromptMerged with ctrl lane argument. */
export function formatCtrlLaneReferenceAppendix(entries: RegistryEntry[], verbosity: PromptVerbosity): string {
  if (entries.length === 0) return "";
  return formatDualLaneTargetsBlock([], entries, verbosity);
}

/** Locked update prefix: header → Target(s) (Alt + Ctrl) → Execution… Tasking… */
export function buildUpdateLockedPrefixMerged(
  pageUrl: string,
  altEntries: RegistryEntry[],
  verbosity: PromptVerbosity = "full",
  ctrlEntries: RegistryEntry[] = [],
): string {
  if (altEntries.length === 0) return "";
  const tmpl = verbosity === "compact" ? DEVID_UPDATE_COMPACT_TEMPLATE : DEVID_UPDATE_TEMPLATE;
  const split =
    verbosity === "compact" ? splitCompactVcTemplate(tmpl) : splitFullVcTemplate(tmpl);
  const multi = altEntries.length + ctrlEntries.length > 1;

  if (!split) {
    const primary = altEntries[0];
    const base = buildUpdateLockedPrefix(
      pageUrl,
      primary.label,
      primary.cid,
      primary.componentTag ?? "Identified",
      primary.searchHint,
      undefined,
      verbosity,
    );
    return (
      base +
      formatMergedTargetsAppendix(altEntries, verbosity) +
      formatCtrlLaneReferenceAppendix(ctrlEntries, verbosity)
    );
  }

  const renderedHead = renderPromptTemplate(split.head, {
    PAGE_URL: pageUrl,
    VISUAL_CONTEXT_SKILL_REF,
  });
  const headOut = ensureVcSkillRefLine(applyPluralObjectiveHead(renderedHead, "update", multi));
  const targets = formatDualLaneTargetsBlock(altEntries, ctrlEntries, verbosity);
  return headOut + targets + split.tail;
}

export function buildDeletePromptMerged(
  pageUrl: string,
  altEntries: RegistryEntry[],
  verbosity: PromptVerbosity = "full",
  ctrlEntries: RegistryEntry[] = [],
): string {
  if (altEntries.length === 0) return "";
  const tmpl = verbosity === "compact" ? DEVID_DELETE_COMPACT_TEMPLATE : DEVID_DELETE_TEMPLATE;
  const split =
    verbosity === "compact" ? splitCompactVcTemplate(tmpl) : splitFullVcTemplate(tmpl);
  const multi = altEntries.length + ctrlEntries.length > 1;

  if (!split) {
    const primary = altEntries[0];
    const base = buildDeletePrompt(
      pageUrl,
      primary.label,
      primary.cid,
      primary.componentTag ?? "Identified",
      primary.searchHint,
      undefined,
      verbosity,
    );
    return (
      base +
      formatMergedTargetsAppendix(altEntries, verbosity) +
      formatCtrlLaneReferenceAppendix(ctrlEntries, verbosity)
    );
  }

  const renderedHead = renderPromptTemplate(split.head, {
    PAGE_URL: pageUrl,
    VISUAL_CONTEXT_SKILL_REF,
  });
  const headOut = ensureVcSkillRefLine(applyPluralObjectiveHead(renderedHead, "delete", multi));
  const targets = formatDualLaneTargetsBlock(altEntries, ctrlEntries, verbosity);
  return headOut + targets + split.tail;
}
