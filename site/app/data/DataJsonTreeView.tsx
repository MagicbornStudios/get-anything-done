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

function previewValue(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "object") return `Object(${Object.keys(value).length})`;
  if (typeof value === "string") return value.length > 48 ? `"${value.slice(0, 48)}..."` : `"${value}"`;
  return String(value);
}

function JsonNode({
  label,
  value,
  depth,
}: {
  label: string;
  value: JsonValue;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const isExpandable = Array.isArray(value) || (typeof value === "object" && value !== null);
  const entries = useMemo(() => {
    if (!isExpandable || !open) return [] as Array<[string, JsonValue]>;
    if (Array.isArray(value)) return value.map((item, index) => [String(index), item] as [string, JsonValue]);
    return Object.entries(value as Record<string, JsonValue>);
  }, [isExpandable, open, value]);

  if (!isExpandable) {
    return (
      <div className="py-0.5 text-[11px]">
        <span className="font-mono text-muted-foreground">{label}:</span>{" "}
        <span className="font-mono text-foreground/90">{previewValue(value)}</span>
      </div>
    );
  }

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      className={cn("py-0.5", depth > 0 ? "border-l border-border/40 pl-2" : "")}
    >
      <summary className="cursor-pointer list-none text-[11px]">
        <span className="font-mono text-muted-foreground">{label}:</span>{" "}
        <span className="font-mono text-foreground/90">{previewValue(value)}</span>
      </summary>
      {open ? (
        <div className="mt-1 pl-2">
          {entries.map(([key, child]) => (
            <JsonNode key={key} label={key} value={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </details>
  );
}

export default function DataJsonTreeView({ data }: { data: unknown }) {
  const normalized = useMemo(() => toJsonValue(data), [data]);
  return (
    <div className="max-h-[62vh] overflow-auto rounded-md border border-border/70 bg-background/40 p-2">
      <JsonNode label="data" value={normalized} depth={0} />
    </div>
  );
}
