"use client";

import { FileText, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canonicalSkillPackageTree,
  catalogSkillFilePaths,
  type SkillRefNode,
} from "./skill-package-reference";

function normalizePath(p: string) {
  return p.replace(/\\/g, "/").replace(/^\//, "");
}

/** Catalog paths are often monorepo-prefixed; reference tree uses `skills/<id>/…`. */
function fileMatchesCatalog(fullRefPath: string, skillId: string, actualSet: Set<string>): boolean {
  const ref = normalizePath(fullRefPath);
  if (actualSet.has(ref)) return true;
  const prefix = `skills/${skillId}/`;
  if (!ref.startsWith(prefix)) return false;
  const rel = ref.slice(prefix.length);
  for (const a of actualSet) {
    const an = normalizePath(a);
    if (an === ref) return true;
    if (an.endsWith(`/skills/${skillId}/${rel}`) || an.endsWith(`${skillId}/${rel}`)) return true;
  }
  return false;
}

function FileTreeRows({
  node,
  basePath,
  depth,
  actualSet,
  skillId,
  compact,
  selectedPath,
  onSelectFile,
}: {
  node: SkillRefNode;
  basePath: string;
  depth: number;
  actualSet: Set<string>;
  skillId: string;
  compact?: boolean;
  /** When set, file rows become selectable and highlight the active path. */
  selectedPath?: string | null;
  onSelectFile?: (fullPath: string) => void;
}) {
  const pad = compact ? Math.min(depth, 4) * 10 : depth * 12;

  if (node.kind === "file") {
    const fullPath = normalizePath(`${basePath}${node.name}`);
    const inCatalog = fileMatchesCatalog(fullPath, skillId, actualSet);
    const active = selectedPath != null && normalizePath(selectedPath) === fullPath;
    const row = (
      <>
        <FileText className="mt-0.5 size-3 shrink-0 text-sky-400/90" aria-hidden />
        <span className="min-w-0 break-all text-foreground/90">{node.name}</span>
        {inCatalog ? (
          <span className="shrink-0 rounded bg-emerald-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
            in catalog
          </span>
        ) : (
          <span className="shrink-0 text-[9px] text-muted-foreground/90">reference</span>
        )}
      </>
    );
    if (onSelectFile) {
      return (
        <button
          type="button"
          title={node.note}
          onClick={() => onSelectFile(fullPath)}
          className={cn(
            "flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left font-mono transition-colors",
            compact ? "text-[10px] leading-snug" : "text-[11px] leading-snug",
            active ? "bg-accent/15 ring-1 ring-accent/40" : "hover:bg-muted/50",
          )}
          style={{ paddingLeft: pad }}
        >
          {row}
        </button>
      );
    }
    return (
      <div
        className={cn(
          "flex items-start gap-1.5 rounded px-1 py-0.5 font-mono",
          compact ? "text-[10px] leading-snug" : "text-[11px] leading-snug",
        )}
        style={{ paddingLeft: pad }}
        title={node.note}
      >
        {row}
      </div>
    );
  }

  const dirPath = node.name.endsWith("/") ? node.name : `${node.name}/`;
  const childBase = `${basePath}${dirPath}`;

  return (
    <div className="space-y-0.5">
      <div
        className={cn(
          "flex items-start gap-1.5 rounded px-1 py-0.5 font-mono text-muted-foreground",
          compact ? "text-[10px] leading-snug" : "text-[11px] leading-snug",
        )}
        style={{ paddingLeft: pad }}
        title={node.note}
      >
        <Folder className="mt-0.5 size-3 shrink-0 text-amber-500/85" aria-hidden />
        <span className="min-w-0 break-all">{node.name}</span>
      </div>
      {node.children?.map((ch) => (
        <FileTreeRows
          key={`${childBase}-${ch.name}`}
          node={ch}
          basePath={childBase}
          depth={depth + 1}
          actualSet={actualSet}
          skillId={skillId}
          compact={compact}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
}

export function SkillPackageFileTreeView({
  skillId,
  sourcePath,
  compact,
  className,
}: {
  skillId: string;
  sourcePath: string;
  compact?: boolean;
  className?: string;
}) {
  const actual = new Set(catalogSkillFilePaths(skillId, sourcePath).map(normalizePath));
  const tree = canonicalSkillPackageTree(skillId);
  return (
    <div className={cn("rounded-md border border-border/50 bg-background/30 p-2", className)}>
      <FileTreeRows
        node={tree}
        basePath=""
        depth={0}
        actualSet={actual}
        skillId={skillId}
        compact={compact}
      />
    </div>
  );
}

/** Whether this reference path is bundled in the marketing catalog (same rules as tree badges). */
export function isBundledSkillFilePath(fullPath: string, skillId: string, sourcePath: string): boolean {
  const actual = new Set(catalogSkillFilePaths(skillId, sourcePath).map(normalizePath));
  return fileMatchesCatalog(normalizePath(fullPath), skillId, actual);
}

/** Default file to show when opening the explorer (first catalog path, else canonical SKILL.md). */
export function defaultSkillFileSelection(skillId: string, sourcePath: string): string {
  const paths = catalogSkillFilePaths(skillId, sourcePath).map(normalizePath);
  if (paths.length > 0) return paths[0]!;
  return `skills/${skillId}/SKILL.md`;
}

/** Text for the modal CodeMirror: bundled paths use catalog `bodyRaw`; others get a short reference-only notice. */
export function skillFileModalPreview(
  selectedPath: string,
  skillId: string,
  sourcePath: string,
  bodyRaw: string,
): string {
  if (!isBundledSkillFilePath(selectedPath, skillId, sourcePath)) {
    return [
      "This path is not part of the bundled catalog preview for this marketing build.",
      "",
      normalizePath(selectedPath),
      "",
      "Open the GAD repo or the skill detail page to inspect it on disk.",
    ].join("\n");
  }
  return bodyRaw;
}

/**
 * Reference tree with clickable files — use with a sibling preview (e.g. ReadonlyCodeMirror).
 */
export function SkillPackageFileTreeInteractive({
  skillId,
  sourcePath,
  selectedPath,
  onSelectFile,
  compact,
  className,
}: {
  skillId: string;
  sourcePath: string;
  selectedPath: string;
  onSelectFile: (fullPath: string) => void;
  compact?: boolean;
  className?: string;
}) {
  const actual = new Set(catalogSkillFilePaths(skillId, sourcePath).map(normalizePath));
  const tree = canonicalSkillPackageTree(skillId);
  return (
    <div className={cn("rounded-md border border-border/50 bg-background/30 p-2", className)}>
      <FileTreeRows
        node={tree}
        basePath=""
        depth={0}
        actualSet={actual}
        skillId={skillId}
        compact={compact}
        selectedPath={selectedPath}
        onSelectFile={onSelectFile}
      />
    </div>
  );
}

export function SkillCatalogFilesOnly({
  skillId,
  sourcePath,
  compact,
}: {
  skillId: string;
  sourcePath: string;
  compact?: boolean;
}) {
  const paths = catalogSkillFilePaths(skillId, sourcePath);
  return (
    <ul className={cn("space-y-1", compact ? "text-[10px]" : "text-[11px]")}>
      {paths.map((p) => (
        <li key={p} className="flex items-center gap-1.5 font-mono text-foreground/90">
          <FileText className="size-3 shrink-0 text-emerald-400/90" aria-hidden />
          <span className="break-all">{normalizePath(p)}</span>
          <span className="shrink-0 text-[9px] font-semibold uppercase text-emerald-400/90">bundled</span>
        </li>
      ))}
    </ul>
  );
}
