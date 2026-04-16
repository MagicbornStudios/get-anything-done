"use client";

import { useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";

type DiffKind = "added" | "removed" | "modified" | "unchanged";

type DiffNode = {
  keyPath: string;
  key: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
  delta?: number | null;
  children?: DiffNode[];
};

function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix = "",
): DiffNode[] {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const nodes: DiffNode[] = [];

  for (const key of allKeys) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    const bVal = before[key];
    const aVal = after[key];

    if (!(key in before)) {
      nodes.push({ keyPath, key, kind: "added", after: aVal });
    } else if (!(key in after)) {
      nodes.push({ keyPath, key, kind: "removed", before: bVal });
    } else if (
      bVal !== null &&
      aVal !== null &&
      typeof bVal === "object" &&
      typeof aVal === "object" &&
      !Array.isArray(bVal) &&
      !Array.isArray(aVal)
    ) {
      const children = diffObjects(
        bVal as Record<string, unknown>,
        aVal as Record<string, unknown>,
        keyPath,
      );
      const hasChanges = children.some((c) => c.kind !== "unchanged");
      nodes.push({
        keyPath,
        key,
        kind: hasChanges ? "modified" : "unchanged",
        children,
      });
    } else if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      const delta =
        typeof bVal === "number" && typeof aVal === "number"
          ? aVal - bVal
          : null;
      nodes.push({ keyPath, key, kind: "modified", before: bVal, after: aVal, delta });
    } else {
      nodes.push({ keyPath, key, kind: "unchanged", before: bVal, after: aVal });
    }
  }

  return nodes;
}

function DiffRow({ node, depth }: { node: DiffNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const kindColor: Record<DiffKind, string> = {
    added: "bg-emerald-500/10 text-emerald-400",
    removed: "bg-red-500/10 text-red-400",
    modified: "bg-amber-500/10 text-amber-400",
    unchanged: "text-muted-foreground/60",
  };

  const kindBorder: Record<DiffKind, string> = {
    added: "border-l-emerald-500/40",
    removed: "border-l-red-500/40",
    modified: "border-l-amber-500/40",
    unchanged: "border-l-transparent",
  };

  const formatValue = (v: unknown): string => {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  return (
    <>
      {/* cid prototype: diff-tree-row-<key-path>-site-section */}
      <div
        className={cn(
          "flex items-baseline gap-2 py-0.5 px-2 border-l-2 text-[11px] font-mono",
          kindBorder[node.kind],
          node.kind !== "unchanged" && kindColor[node.kind],
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-3 shrink-0 text-center text-muted-foreground hover:text-foreground"
          >
            {expanded ? "\u25BC" : "\u25B6"}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        <span className="shrink-0 text-foreground/70">{node.key}</span>

        {!hasChildren && node.kind === "added" && (
          <span className="truncate text-emerald-400">
            + {formatValue(node.after)}
          </span>
        )}
        {!hasChildren && node.kind === "removed" && (
          <span className="truncate text-red-400 line-through">
            {formatValue(node.before)}
          </span>
        )}
        {!hasChildren && node.kind === "modified" && (
          <span className="truncate">
            <span className="text-red-400/70 line-through mr-1">
              {formatValue(node.before)}
            </span>
            <span className="text-emerald-400">
              {formatValue(node.after)}
            </span>
            {node.delta !== null && node.delta !== undefined && (
              <span
                className={cn(
                  "ml-1",
                  node.delta > 0 ? "text-emerald-400" : "text-red-400",
                )}
              >
                ({node.delta > 0 ? "+" : ""}
                {node.delta.toFixed(3)})
              </span>
            )}
          </span>
        )}
        {!hasChildren && node.kind === "unchanged" && (
          <span className="truncate text-muted-foreground/40">
            {formatValue(node.after)}
          </span>
        )}
      </div>

      {hasChildren && expanded &&
        node.children!.map((child) => (
          <DiffRow key={child.keyPath} node={child} depth={depth + 1} />
        ))}
    </>
  );
}

export function DiffTree({
  before,
  after,
  label,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  label?: string;
}) {
  const nodes = diffObjects(before, after);
  const changedCount = nodes.filter((n) => n.kind !== "unchanged").length;

  return (
    <SiteSection
      cid="project-editor-diff-tree-site-section"
      sectionShell={false}
      className="border-b-0"
    >
      <div className="py-2">
        {label && (
          <div className="flex items-center gap-2 px-3 mb-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </h3>
            <span className="text-[10px] text-muted-foreground/50">
              {changedCount} change{changedCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        <div className="space-y-0">
          {nodes.map((node) => (
            <DiffRow key={node.keyPath} node={node} depth={0} />
          ))}
          {nodes.length === 0 && (
            <p className="px-3 text-[11px] text-muted-foreground/50">
              No data to compare
            </p>
          )}
        </div>
      </div>
    </SiteSection>
  );
}
