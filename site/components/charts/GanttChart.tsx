"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";

export interface GanttItem {
  id: string;
  label: string;
  start: number; // position index (0-based)
  duration: number; // bar width in units
  color?: string;
  status?: string;
  stats?: Record<string, string | number>;
  children?: GanttItem[];
}

interface GanttChartProps {
  items: GanttItem[];
  columns: string[]; // column labels (e.g., phase numbers or round names)
  title?: string;
  onItemClick?: (item: GanttItem) => void;
  selectedId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  done: "bg-emerald-500/70",
  active: "bg-accent/70",
  planned: "bg-muted/50",
  complete: "bg-emerald-500/70",
  "awaiting_review": "bg-amber-500/70",
};

function getBarColor(item: GanttItem): string {
  if (item.color) return item.color;
  return STATUS_COLORS[item.status || ""] || "bg-accent/50";
}

export function GanttChart({ items, columns, title, onItemClick, selectedId }: GanttChartProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const totalCols = columns.length;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/30">
      {title && (
        <div className="border-b border-border/60 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        </div>
      )}
      {/* Column headers */}
      <div className="flex border-b border-border/40">
        <div className="w-40 shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Item
        </div>
        <div className="flex flex-1">
          {columns.map((col) => (
            <div
              key={col}
              className="flex-1 border-l border-border/30 px-1 py-2 text-center text-[10px] font-medium text-muted-foreground/70"
            >
              {col}
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      {items.map((item) => (
        <div key={item.id}>
          <div
            className={[
              "flex items-center border-b border-border/30 transition-colors",
              selectedId === item.id ? "bg-accent/10" : "hover:bg-card/60",
              onItemClick ? "cursor-pointer" : "",
            ].join(" ")}
            onClick={() => {
              if (item.children?.length) toggleExpand(item.id);
              onItemClick?.(item);
            }}
          >
            {/* Label */}
            <div className="w-40 shrink-0 px-3 py-2.5">
              <HoverCard openDelay={200} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <span className="text-xs font-medium text-foreground truncate block">
                    {item.children?.length ? (expanded.has(item.id) ? "▾ " : "▸ ") : ""}
                    {item.label}
                  </span>
                </HoverCardTrigger>
                {item.stats && (
                  <HoverCardContent side="right" align="start" className="w-56">
                    <p className="text-xs font-semibold text-foreground mb-2">{item.label}</p>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      {Object.entries(item.stats).map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-muted-foreground/70 uppercase tracking-wider">{k}</dt>
                          <dd className="font-medium text-foreground tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    {item.status && (
                      <div className="mt-2">
                        <Badge variant={item.status === "done" || item.status === "complete" ? "success" : "outline"}>
                          {item.status}
                        </Badge>
                      </div>
                    )}
                  </HoverCardContent>
                )}
              </HoverCard>
            </div>

            {/* Bar area */}
            <div className="flex flex-1 items-center py-1.5">
              {columns.map((_, colIdx) => {
                const inBar = colIdx >= item.start && colIdx < item.start + item.duration;
                const isFirst = colIdx === item.start;
                const isLast = colIdx === item.start + item.duration - 1;
                return (
                  <div key={colIdx} className="flex-1 border-l border-border/20 px-0.5 py-1">
                    {inBar && (
                      <div
                        className={[
                          "h-5",
                          getBarColor(item),
                          isFirst ? "rounded-l-md" : "",
                          isLast ? "rounded-r-md" : "",
                        ].join(" ")}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expanded children */}
          {expanded.has(item.id) && item.children?.map((child) => (
            <div
              key={child.id}
              className="flex items-center border-b border-border/20 bg-card/20"
              onClick={() => onItemClick?.(child)}
            >
              <div className="w-40 shrink-0 px-3 py-1.5 pl-7">
                <span className="text-[11px] text-muted-foreground truncate block">{child.label}</span>
              </div>
              <div className="flex flex-1 items-center py-1">
                {columns.map((_, colIdx) => {
                  const inBar = colIdx >= child.start && colIdx < child.start + child.duration;
                  const isFirst = colIdx === child.start;
                  const isLast = colIdx === child.start + child.duration - 1;
                  return (
                    <div key={colIdx} className="flex-1 border-l border-border/10 px-0.5 py-0.5">
                      {inBar && (
                        <div
                          className={[
                            "h-3",
                            getBarColor(child),
                            isFirst ? "rounded-l-sm" : "",
                            isLast ? "rounded-r-sm" : "",
                          ].join(" ")}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
