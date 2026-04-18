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

/**
 * Appends session-export image paths to handoff text (browser-relative: `folderName/file.png`).
 * Delete role adds explicit disk-removal instructions when paths are non-empty.
 */
export function formatVcPromptMediaRefs(
  paths: string[],
  role: "update" | "delete",
  verbosity: PromptVerbosity,
): string {
  if (paths.length === 0) return "";
  const lines = paths.map((p, i) => `  ${i + 1}. ${p}`);
  if (role === "update") {
    if (verbosity === "compact") {
      return `\n\nMedia path(s) (update): ${paths.join("; ")}\n`;
    }
    return `\n\nMedia path(s) from the session export folder — attach, replace, or align code with these image(s):\n${lines.join("\n")}\n`;
  }
  if (verbosity === "compact") {
    return `\n\nMedia (delete): ${paths.join("; ")}\n\nAlso delete those files from the same export folder on disk, not only in-repo references.\n`;
  }
  return (
    `\n\nMedia references (remove from the UI and delete the files from the session export folder you used for PNG / media picks):\n${lines.join("\n")}\n` +
    `\nAfter removing in-repo references, delete the listed files from disk at that folder location (the browser-granted export directory), not only from the repository.\n`
  );
}

/**
 * Appended when the user copies the delete handoff with Ctrl/Cmd held: instruct the agent to remove
 * matching image file(s) from the author’s browser-granted VC export folder when that path is reachable.
 */
export function formatVcDeleteHandoffBrowserStorageAppendix(verbosity: PromptVerbosity): string {
  if (verbosity === "compact") {
    return `\n\nBrowser VC export: If your environment can reach the same on-disk folder the author used for Visual Context (paths under Media above), delete those image file(s) there; otherwise remove in-repo references only.\n`;
  }
  return `\n\n## Browser / session export storage (targets above)\nThe author may have saved screenshots or picked images into a folder granted by the browser (File System Access). If your working environment has access to that same directory or the same relative paths listed in the Media section, delete the corresponding image file(s) from storage as part of removing this UI. If you only have the repository, remove references and bundled assets in-repo; do not assume access to the author’s local export folder.\n`;
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

/**
 * Outer-lane update prompt — user's notes target the neighborhood around an anchor that is
 * almost certainly NOT yet identified in VCS (no `Identified` / `data-cid` / stableCid). The
 * anchor is passed for locating the file/region only; the agent's first job is to walk
 * parents/siblings in the same JSX tree, add identification per the VCS skill, and then apply
 * the user's requested update to those surrounding components.
 */
export function buildOuterUpdateLockedPrefix(
  pageUrl: string,
  label: string,
  cid: string,
  componentTag: HandoffComponentTag,
  searchHint?: string,
  verbosity: PromptVerbosity = "full",
): string {
  const labelShort = truncateForPrompt(label, BLOCK_LABEL_MAX);
  const cidShort = truncateForPrompt(cid, BLOCK_CID_MAX);
  const searchShort = truncateForPrompt(searchHint ?? cid, Math.max(BLOCK_LABEL_MAX, BLOCK_CID_MAX));
  const tag = componentTag ?? "Identified";

  if (verbosity === "compact") {
    return (
      `Update outer region (Ctrl lane).\n` +
      `Route: ${pageUrl}\n` +
      `Anchor: ${tag} | ${escapeAttrInCode(labelShort)}\n` +
      `anchor-search: ${escapeAttrInCode(searchShort)}\n` +
      `anchor-data-cid: ${escapeAttrInCode(cidShort)}\n` +
      `Scope: components AROUND the anchor, likely missing \`Identified\` / \`data-cid\`.\n` +
      `Skill ref (mandatory): ${VISUAL_CONTEXT_SKILL_REF}\n` +
      `\n` +
      `Plan: (1) open the anchor's file, (2) list unidentified sibling/parent JSX candidates in the same section, ` +
      `(3) refactor them to carry \`<Identified as="..." stableCid="..." />\` or \`data-cid\`, ` +
      `(4) apply the user's notes below.\n\n` +
      `<workflow name="subagent-reuse">\n` +
      `  <branch if="matched_subagent_exists_and_same_or_similar_ui_context">\n` +
      `    <output>Reuse matched subagent via \`send_input\` with \`interrupt=true\`.</output>\n` +
      `  </branch>\n` +
      `  <else>\n` +
      `    <output>Spawn one subagent for this UI area.</output>\n` +
      `  </else>\n` +
      `</workflow>\n` +
      `\nTasking (outer-update — user's notes follow):\n`
    );
  }

  return (
    `Objective: identify + update the outer/surrounding region around an anchor target.\n` +
    `Route: **${pageUrl}**\n` +
    `Skill ref (mandatory): ${VISUAL_CONTEXT_SKILL_REF}\n` +
    `\n` +
    `Anchor (known — locate this first, then work outward):\n` +
    `- wrapper: ${tag}\n` +
    `- as: ${escapeAttrInCode(labelShort)}\n` +
    `- search: ${escapeAttrInCode(searchShort)}\n` +
    `- data-cid: ${escapeAttrInCode(cidShort)}\n` +
    `- role: anchor only — the user's notes describe the NEIGHBORHOOD, not this node\n` +
    `\n` +
    `Outer scope (likely unidentified — this is why the outer lane was used):\n` +
    `- The surrounding components almost certainly do NOT yet carry \`Identified\` / \`data-cid\` / \`stableCid\`, or carry them too coarsely to target individually.\n` +
    `- First pass: open the file containing the anchor, walk parent / sibling / adjacent JSX in the same section, and list candidates that need VCS identity.\n` +
    `- Refactor those candidates per the skill ref — add \`<Identified as="..." stableCid="...">\` or \`data-cid\` attributes. Keep identifiers greppable from source (kebab-case, literal strings).\n` +
    `- Only after the surrounding region is legible to VCS: apply the user's requested change in the Tasking block below.\n` +
    `\n` +
    `Execution model:\n` +
    `- Default: subagent.\n` +
    `- Subagent scope: the anchor's file + adjacent JSX in the same section. Do not pull in unrelated features.\n` +
    `- If multiple sibling components need identification, land the identification refactor in one atomic commit before making user-facing changes.\n` +
    `\n` +
    `<workflow name="subagent-reuse">\n` +
    `  <step id="match-context">Match existing subagent by same route and similar UI context (anchor \`as\`, \`cid\`, section wording).</step>\n` +
    `  <branch if="user_says_new_lane">\n` +
    `    <output>Spawn new subagent lane.</output>\n` +
    `  </branch>\n` +
    `  <branch if="matched_subagent_exists">\n` +
    `    <output>Reuse matched subagent via \`send_input\` with \`interrupt=true\`.</output>\n` +
    `  </branch>\n` +
    `  <else>\n` +
    `    <output>Spawn one subagent for this UI area.</output>\n` +
    `  </else>\n` +
    `</workflow>\n` +
    `\n` +
    `Report:\n` +
    `- identification-added: list of new \`as\` + \`stableCid\` pairs introduced around the anchor\n` +
    `- changes-applied: what the user's notes asked for, once the neighborhood was legible\n` +
    `- preserve route / anchor as / anchor search / anchor data-cid\n` +
    `\n` +
    `Tasking (outer-update — user's notes follow):\n`
  );
}

/**
 * Outer-lane delete prompt — user wants to remove the unidentifiable components around an anchor.
 * Anchor is the locate-point only; the agent must figure out which surrounding JSX the notes refer to
 * (often load-bearing, often uncovered in VCS) and remove it cleanly.
 */
export function buildOuterDeletePrompt(
  pageUrl: string,
  label: string,
  cid: string,
  componentTag: HandoffComponentTag,
  searchHint?: string,
  verbosity: PromptVerbosity = "full",
): string {
  const labelShort = truncateForPrompt(label, BLOCK_LABEL_MAX);
  const cidShort = truncateForPrompt(cid, BLOCK_CID_MAX);
  const searchShort = truncateForPrompt(searchHint ?? cid, Math.max(BLOCK_LABEL_MAX, BLOCK_CID_MAX));
  const tag = componentTag ?? "Identified";

  if (verbosity === "compact") {
    return (
      `Delete outer region (Alt lane).\n` +
      `Route: ${pageUrl}\n` +
      `Anchor (keep): ${tag} | ${escapeAttrInCode(labelShort)}\n` +
      `anchor-search: ${escapeAttrInCode(searchShort)}\n` +
      `anchor-data-cid: ${escapeAttrInCode(cidShort)}\n` +
      `Scope: unidentified components AROUND the anchor — the user's notes name which ones to remove.\n` +
      `Skill ref (mandatory): ${VISUAL_CONTEXT_SKILL_REF}\n` +
      `\nCleanup: remove dead imports/components/assets; typecheck touched package; preserve the anchor.\n` +
      `\n<workflow name="subagent-reuse">\n` +
      `  <branch if="matched_subagent_exists_and_same_or_similar_ui_context">\n` +
      `    <output>Reuse matched subagent via \`send_input\` with \`interrupt=true\`.</output>\n` +
      `  </branch>\n` +
      `  <else>\n` +
      `    <output>Spawn one subagent for this UI area.</output>\n` +
      `  </else>\n` +
      `</workflow>\n` +
      `\nTasking (outer-delete — user's notes follow):\n`
    );
  }

  return (
    `Objective: delete unidentified surrounding components around an anchor target.\n` +
    `Route: **${pageUrl}**\n` +
    `Skill ref (mandatory): ${VISUAL_CONTEXT_SKILL_REF}\n` +
    `\n` +
    `Anchor (keep — use only to locate the neighborhood):\n` +
    `- wrapper: ${tag}\n` +
    `- as: ${escapeAttrInCode(labelShort)}\n` +
    `- search: ${escapeAttrInCode(searchShort)}\n` +
    `- data-cid: ${escapeAttrInCode(cidShort)}\n` +
    `- role: DO NOT delete this node — it's the reference point\n` +
    `\n` +
    `Outer scope (targets for deletion):\n` +
    `- Around the anchor are components/sections that are NOT yet identified in VCS (no \`Identified\` / \`data-cid\`), which is why the outer delete lane was used.\n` +
    `- The user's notes below name specifically which surrounding region(s) to remove. If the notes are ambiguous, first list candidate sibling/parent components you can see in the file, then apply the user's instructions against that list.\n` +
    `- Remove dead imports, unused components, and any assets that were only referenced by the deleted region.\n` +
    `- Preserve the anchor and any siblings the user didn't call out.\n` +
    `\n` +
    `Execution model:\n` +
    `- Default: subagent.\n` +
    `- Subagent scope: the anchor's file + adjacent JSX. Touch only the removed region's imports and assets.\n` +
    `\n` +
    `<workflow name="subagent-reuse">\n` +
    `  <step id="match-context">Match existing subagent by same route and similar UI context (anchor \`as\`, \`cid\`, section wording).</step>\n` +
    `  <branch if="user_says_new_lane">\n` +
    `    <output>Spawn new subagent lane.</output>\n` +
    `  </branch>\n` +
    `  <branch if="matched_subagent_exists">\n` +
    `    <output>Reuse matched subagent via \`send_input\` with \`interrupt=true\`.</output>\n` +
    `  </branch>\n` +
    `  <else>\n` +
    `    <output>Spawn one subagent for this UI area.</output>\n` +
    `  </else>\n` +
    `</workflow>\n` +
    `\n` +
    `Report:\n` +
    `- removed: list of deleted components + file paths\n` +
    `- cleanup: imports / assets / dead refs pruned\n` +
    `- anchor preserved: confirm \`${escapeAttrInCode(cidShort)}\` still renders\n` +
    `\n` +
    `Tasking (outer-delete — user's notes follow):\n`
  );
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
