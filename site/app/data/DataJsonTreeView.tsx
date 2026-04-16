"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function toJsonValue(value: unknown): JsonValue {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item));
  if (typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJsonValue(v);
    return out;
  }
  return String(value);
}

function compactPreview(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === "object") return `{${Object.keys(value).length}}`;
  if (typeof value === "string") return value.length > 36 ? `\"${value.slice(0, 36)}...\"` : `\"${value}\"`;
  return String(value);
}

function JsonLeaf({ label, value }: { label: string; value: JsonValue }) {
  return (
    <div className="py-0.5 text-[11px] leading-relaxed">
      <span className="font-mono text-sky-300">"{label}"</span>
      <span className="font-mono text-muted-foreground">: </span>
      <span className="font-mono text-foreground/90">{compactPreview(value)}</span>
    </div>
  );
}

function JsonNode({
  label,
  value,
  depth,
  defaultOpenDepth,
}: {
  label: string;
  value: JsonValue;
  depth: number;
  defaultOpenDepth: number;
}) {
  const [open, setOpen] = useState(depth < defaultOpenDepth);
  const isObject = typeof value === "object" && value !== null && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const entries = useMemo(() => {
    if (!isExpandable || !open) return [] as Array<[string, JsonValue]>;
    if (isArray) return value.map((item, index) => [String(index), item] as [string, JsonValue]);
    return Object.entries(value as Record<string, JsonValue>);
  }, [isExpandable, isArray, open, value]);

  if (!isExpandable) return <JsonLeaf label={label} value={value} />;

  const openToken = isArray ? "[" : "{";
  const closeToken = isArray ? "]" : "}";

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      className={cn("py-0.5", depth > 0 ? "border-l border-border/40 pl-2" : "")}
    >
      <summary className="cursor-pointer list-none text-[11px] leading-relaxed">
        <span className="font-mono text-sky-300">"{label}"</span>
        <span className="font-mono text-muted-foreground">: </span>
        <span className="font-mono text-amber-300">{openToken}</span>
        <span className="ml-1 font-mono text-muted-foreground">{compactPreview(value)}</span>
      </summary>
      {open ? (
        <div className="pl-2">
          {entries.map(([key, child]) => (
            <JsonNode key={key} label={key} value={child} depth={depth + 1} defaultOpenDepth={defaultOpenDepth} />
          ))}
          <div className="text-[11px] leading-relaxed">
            <span className="font-mono text-amber-300">{closeToken}</span>
          </div>
        </div>
      ) : null}
    </details>
  );
}

export default function DataJsonTreeView({ data }: { data: unknown }) {
  const normalized = useMemo(() => toJsonValue(data), [data]);

  return (
    <div className="max-h-[62vh] overflow-auto rounded-md border border-border/70 bg-background/40 p-2">
      <JsonNode label="payload" value={normalized} depth={0} defaultOpenDepth={1} />
    </div>
  );
}
