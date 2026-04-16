"use client";

import { useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";

/**
 * Minecraft-style inventory grid primitive for config editing.
 *
 * Renders an object (gad.json, species.json, scoring weights, constraints)
 * as a grid of slots. Each slot shows a key-value pair. Clicking a slot
 * opens an inline editor. Supports nested objects as sub-grids.
 *
 * VCS cids:
 *   project-editor-inventory-grid-site-section
 *   // cid prototype: inventory-slot-<key-path>-site-section
 */

type SlotValue = string | number | boolean | null | Record<string, unknown>;

type InventorySlot = {
  key: string;
  keyPath: string;
  value: SlotValue;
  type: "string" | "number" | "boolean" | "null" | "object" | "array";
};

function flattenObject(obj: Record<string, unknown>, prefix = ""): InventorySlot[] {
  const slots: InventorySlot[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      // Nested object — show as a group header then recurse
      slots.push({
        key,
        keyPath,
        value: value as Record<string, unknown>,
        type: "object",
      });
      slots.push(...flattenObject(value as Record<string, unknown>, keyPath));
    } else if (Array.isArray(value)) {
      slots.push({ key, keyPath, value: `[${value.length}]`, type: "array" });
    } else {
      slots.push({
        key,
        keyPath,
        value: value as SlotValue,
        type:
          value === null ? "null"
          : typeof value === "boolean" ? "boolean"
          : typeof value === "number" ? "number"
          : "string",
      });
    }
  }
  return slots;
}

function SlotCell({
  slot,
  isGroupHeader,
  onEdit,
}: {
  slot: InventorySlot;
  isGroupHeader: boolean;
  onEdit?: (keyPath: string, newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  if (isGroupHeader) {
    return (
      <div className="col-span-full mt-2 first:mt-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          {slot.key}
        </span>
      </div>
    );
  }

  const displayValue =
    slot.value === null ? "null"
    : slot.value === true ? "true"
    : slot.value === false ? "false"
    : String(slot.value);

  const typeColor =
    slot.type === "number" ? "text-blue-400"
    : slot.type === "boolean" ? "text-amber-400"
    : slot.type === "null" ? "text-red-400/50"
    : slot.type === "array" ? "text-purple-400"
    : "text-foreground/70";

  return (
    // cid prototype: inventory-slot-<key-path>-site-section
    <div
      className={cn(
        "rounded border border-border/30 px-2 py-1.5 transition-colors",
        "hover:border-accent/30 hover:bg-accent/5 cursor-pointer",
        "flex flex-col gap-0.5",
      )}
      onClick={() => {
        if (onEdit && slot.type !== "object" && slot.type !== "array") {
          setEditValue(displayValue);
          setEditing(true);
        }
      }}
    >
      <span className="text-[9px] text-muted-foreground/50 truncate">
        {slot.key}
      </span>
      {editing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            setEditing(false);
            onEdit?.(slot.keyPath, editValue);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEditing(false);
              onEdit?.(slot.keyPath, editValue);
            }
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
          className="bg-transparent text-[11px] font-mono outline-none border-b border-accent w-full"
        />
      ) : (
        <span className={cn("text-[11px] font-mono truncate", typeColor)}>
          {displayValue}
        </span>
      )}
    </div>
  );
}

export function InventoryGrid({
  data,
  title,
  onEdit,
}: {
  data: Record<string, unknown>;
  title?: string;
  onEdit?: (keyPath: string, newValue: string) => void;
}) {
  const slots = flattenObject(data);

  return (
    <SiteSection
      cid="project-editor-inventory-grid-site-section"
      sectionShell={false}
      className="border-b-0"
    >
      <div className="px-3 py-2">
        {title && (
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {title}
          </h3>
        )}
        <div className="grid grid-cols-2 gap-1">
          {slots.map((slot) => (
            <SlotCell
              key={slot.keyPath}
              slot={slot}
              isGroupHeader={slot.type === "object"}
              onEdit={onEdit}
            />
          ))}
        </div>
      </div>
    </SiteSection>
  );
}
