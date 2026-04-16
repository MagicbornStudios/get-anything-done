"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteSection } from "@/components/site";
import { cn } from "@/lib/utils";
import { useCommandBridge } from "./use-command-bridge";

type GeneEntry = {
  slug: string;
  name: string;
  status: string;
};

type CommandDef = {
  id: string;
  label: string;
  description: string;
  subcommand: string;
  args: (slug?: string) => string[];
  needsSlug: boolean;
};

const COMMANDS: CommandDef[] = [
  { id: "try", label: "try", description: "Trial a skill temporarily", subcommand: "try", args: (slug) => [slug ?? ""], needsSlug: true },
  { id: "promote", label: "promote", description: "Promote a mutation to DNA", subcommand: "evolution", args: (slug) => ["promote", slug ?? ""], needsSlug: true },
  { id: "shed", label: "shed", description: "Shed a gene from DNA", subcommand: "evolution", args: (slug) => ["shed", slug ?? ""], needsSlug: true },
  { id: "validate", label: "validate", description: "Validate a mutation", subcommand: "evolution", args: (slug) => ["validate", slug ?? ""], needsSlug: true },
  { id: "show", label: "show", description: "Show skill details", subcommand: "skill", args: (slug) => ["show", slug ?? ""], needsSlug: true },
  { id: "status", label: "status", description: "Show trial status", subcommand: "try", args: () => ["status"], needsSlug: false },
  { id: "graph", label: "graph", description: "Rebuild the planning graph", subcommand: "graph", args: () => ["build"], needsSlug: false },
  { id: "query", label: "query", description: "Query the planning graph", subcommand: "query", args: (text) => [text ?? ""], needsSlug: true },
  { id: "snapshot", label: "snapshot", description: "Full project snapshot", subcommand: "snapshot", args: () => [], needsSlug: false },
  { id: "state", label: "state", description: "Current planning state", subcommand: "state", args: () => [], needsSlug: false },
];

export function CommandPalette({
  genes,
  onClose,
  onPreview,
}: {
  genes: GeneEntry[];
  onClose: () => void;
  onPreview?: (url: string, title: string) => void;
}) {
  const [input, setInput] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { state: bridgeState, run } = useCommandBridge();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Parse input: "try scaffold" -> command=try, arg=scaffold
  const parsed = useMemo(() => {
    const parts = input.trim().split(/\s+/);
    const cmdText = parts[0]?.toLowerCase() ?? "";
    const argText = parts.slice(1).join(" ");
    return { cmdText, argText };
  }, [input]);

  // Filter commands matching input
  const matchedCommands = useMemo(() => {
    if (!parsed.cmdText) return COMMANDS;
    return COMMANDS.filter(
      (c) => c.id.startsWith(parsed.cmdText) || c.label.startsWith(parsed.cmdText),
    );
  }, [parsed.cmdText]);

  // Filter gene slugs for autocomplete
  const matchedGenes = useMemo(() => {
    if (!parsed.argText) return genes.slice(0, 10);
    const lower = parsed.argText.toLowerCase();
    return genes.filter(
      (g) => g.slug.includes(lower) || g.name.toLowerCase().includes(lower),
    ).slice(0, 10);
  }, [genes, parsed.argText]);

  const handleSubmit = useCallback(() => {
    const cmd = matchedCommands[0];
    if (!cmd) return;

    const slug = parsed.argText || (matchedGenes[0]?.slug ?? "");
    const args = cmd.args(slug);

    run({ subcommand: cmd.subcommand, args: args.filter(Boolean) });
  }, [matchedCommands, parsed.argText, matchedGenes, run]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, matchedCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    }
  };

  const outputLines =
    bridgeState.kind === "done" || bridgeState.kind === "running"
      ? bridgeState.lines.filter((l) => l.stream === "stdout").map((l) => l.text)
      : [];

  return (
    <SiteSection
      cid="project-editor-command-palette-site-section"
      sectionShell={false}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 border-b-0"
      allowContextPanel={false}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border/60 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center border-b border-border/40 px-4 py-3">
          <span className="mr-2 text-sm text-muted-foreground">{'>'}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="try scaffold, promote ..., query open tasks, graph"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
          />
          {bridgeState.kind === "running" && (
            <span className="text-[10px] text-muted-foreground animate-pulse">running...</span>
          )}
        </div>

        {/* Command suggestions */}
        {bridgeState.kind === "idle" && (
          <div className="max-h-60 overflow-y-auto">
            {matchedCommands.map((cmd, i) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => {
                  setInput(cmd.id + " ");
                  inputRef.current?.focus();
                }}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors",
                  i === selectedIdx ? "bg-accent/10 text-accent" : "hover:bg-card/50",
                )}
              >
                <span className="font-mono">{cmd.label}</span>
                <span className="text-xs text-muted-foreground">{cmd.description}</span>
              </button>
            ))}

            {/* Gene autocomplete */}
            {parsed.cmdText && matchedGenes.length > 0 && (
              <div className="border-t border-border/40 px-4 py-1">
                <p className="text-[10px] text-muted-foreground/50 mb-1">Genes</p>
                {matchedGenes.map((g) => (
                  <button
                    key={g.slug}
                    type="button"
                    onClick={() => {
                      setInput(`${parsed.cmdText} ${g.slug}`);
                      inputRef.current?.focus();
                    }}
                    className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-card/50 rounded"
                  >
                    <span className="font-mono">{g.slug}</span>
                    <span className="text-muted-foreground/50 truncate">{g.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Output */}
        {outputLines.length > 0 && (
          <div className="border-t border-border/40">
            <pre className="max-h-48 overflow-y-auto p-3 text-[11px] font-mono text-foreground/70 leading-relaxed">
              {outputLines.join("\n")}
            </pre>
          </div>
        )}
      </div>
    </SiteSection>
  );
}
