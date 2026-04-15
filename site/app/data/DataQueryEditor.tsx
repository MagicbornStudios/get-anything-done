"use client";

import { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type ViewUpdate, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { cn } from "@/lib/utils";
import { QUERY_FIELDS, QUERY_TRUST_VALUES } from "./query";

const QUERY_KEYWORDS_PATTERN = /\b(FROM|WHERE|AND|SORT|LIMIT|SELECT|ASC|DESC)\b/gi;
const QUERY_OPERATORS_PATTERN = /(>=|<=|!=|=|:|>|<)/g;
const QUERY_FIELD_NAMES_PATTERN = /\b(id|surface|number|source|formula|trust|page|notes|sourceLength|formulaLength|notesLength)\b/g;

type QueryHint = {
  label: string;
  insert: string;
  detail: string;
};

type QueryHintState = {
  hints: QueryHint[];
  activeToken: string;
};

const MONGO_KEYS = ["collection", "filter", "project", "sort", "limit"] as const;
const MONGO_OPERATORS = [
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
  "$regex",
  "$exists",
  "$and",
  "$or",
] as const;

function buildDecorations(view: EditorView) {
  const decorations = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);

    for (const match of text.matchAll(QUERY_KEYWORDS_PATTERN)) {
      if (match.index == null) continue;
      const start = from + match.index;
      decorations.push(Decoration.mark({ class: "cm-query-keyword" }).range(start, start + match[0].length));
    }

    for (const match of text.matchAll(QUERY_FIELD_NAMES_PATTERN)) {
      if (match.index == null) continue;
      const start = from + match.index;
      decorations.push(Decoration.mark({ class: "cm-query-field" }).range(start, start + match[0].length));
    }

    for (const match of text.matchAll(QUERY_OPERATORS_PATTERN)) {
      if (match.index == null) continue;
      const start = from + match.index;
      decorations.push(Decoration.mark({ class: "cm-query-operator" }).range(start, start + match[0].length));
    }
  }

  return Decoration.set(decorations, true);
}

const queryHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (instance) => instance.decorations,
  },
);

const queryTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      maxHeight: "100%",
      backgroundColor: "transparent",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
      lineHeight: "1.5",
    },
    ".cm-content": {
      minHeight: "160px",
      padding: "12px",
    },
    ".cm-query-keyword": {
      color: "oklch(0.78 0.14 205)",
      fontWeight: "700",
      letterSpacing: "0.02em",
    },
    ".cm-query-field": {
      color: "oklch(0.82 0.1 140)",
      fontWeight: "600",
    },
    ".cm-query-operator": {
      color: "oklch(0.85 0.16 80)",
      fontWeight: "700",
    },
    ".cm-gutters": {
      backgroundColor: "color-mix(in oklch, var(--muted) 35%, transparent)",
      borderRight: "1px solid var(--border)",
    },
  },
  { dark: true },
);

type Props = {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  className?: string;
  collections?: string[];
};

function deriveQueryHints(docText: string, cursorPos: number, collections: string[]): QueryHintState {
  const uniqueCollections = [...new Set(["active", ...collections.map((name) => name.toLowerCase())])];
  const beforeCursor = docText.slice(0, cursorPos);
  const lineStartsAt = beforeCursor.lastIndexOf("\n", Math.max(0, beforeCursor.length - 1)) + 1;
  const lineText = beforeCursor.slice(lineStartsAt);
  const tokenMatch = lineText.match(/[$A-Za-z_][\w$-]*$/);
  const token = tokenMatch?.[0] ?? "";
  const tokenLower = token.toLowerCase();
  const filterHints = (hints: QueryHint[]) =>
    tokenLower ? hints.filter((hint) => hint.label.toLowerCase().startsWith(tokenLower)) : hints;

  const nearCollectionValue = /"collection"\s*:\s*"[^"]*$/.test(beforeCursor);
  const nearTrustValue = /"trust"\s*:\s*"[^"]*$/.test(beforeCursor);
  const nearOperatorValue = /"\$[\w-]*$/.test(beforeCursor) || /\$[\w-]*$/.test(lineText);
  const nearRootOrObjectKey = /[{,]\s*"?[A-Za-z_][\w-]*$/.test(lineText);
  const inFilterLikeContext = /"(filter|sort|project)"\s*:\s*\{[^}]*$/.test(beforeCursor);
  const inJsonLikeContext = /[\[{]/.test(beforeCursor);

  if (!inJsonLikeContext) {
    return { activeToken: "", hints: [] };
  }

  if (nearCollectionValue) {
    return {
      activeToken: token,
      hints: filterHints(uniqueCollections.map((name) => ({ label: name, insert: name, detail: "collection" }))).slice(
        0,
        8,
      ),
    };
  }

  if (nearTrustValue) {
    return {
      activeToken: token,
      hints: filterHints(
        QUERY_TRUST_VALUES.map((value) => ({
          label: value,
          insert: value,
          detail: "trust value",
        })),
      ).slice(0, 6),
    };
  }

  if (nearOperatorValue) {
    return {
      activeToken: token,
      hints: filterHints(
        MONGO_OPERATORS.map((op) => ({
          label: op,
          insert: op,
          detail: "operator",
        })),
      ).slice(0, 8),
    };
  }

  if (nearRootOrObjectKey || inFilterLikeContext) {
    return {
      activeToken: token,
      hints: filterHints([
        ...MONGO_KEYS.map((key) => ({ label: key, insert: key, detail: "query key" })),
        ...QUERY_FIELDS.map((field) => ({ label: field, insert: field, detail: "field" })),
      ]).slice(0, 10),
    };
  }

  return { activeToken: "", hints: [] };
}

export default function DataQueryEditor({ value, onChange, onRun, className, collections = [] }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  const collectionsRef = useRef(collections);
  const [hints, setHints] = useState<QueryHint[]>([]);
  const hintsRef = useRef<QueryHint[]>([]);
  const [activeToken, setActiveToken] = useState("");
  const activeTokenRef = useRef("");
  const [selectedHintIndex, setSelectedHintIndex] = useState(0);
  const selectedHintIndexRef = useRef(0);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  useEffect(() => {
    activeTokenRef.current = activeToken;
  }, [activeToken]);

  useEffect(() => {
    selectedHintIndexRef.current = selectedHintIndex;
  }, [selectedHintIndex]);

  useEffect(() => {
    collectionsRef.current = collections;
    const view = viewRef.current;
    if (!view) return;
    const { hints: nextHints, activeToken: nextToken } = deriveQueryHints(
      view.state.doc.toString(),
      view.state.selection.main.head,
      collections,
    );
    hintsRef.current = nextHints;
    setHints(nextHints);
    setActiveToken(nextToken);
    setSelectedHintIndex(0);
  }, [collections]);

  const applyHint = (hint: QueryHint) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    const prefix = line.text.slice(0, from - line.from);
    const tokenMatch = prefix.match(/[$A-Za-z_][\w$-]*$/);
    const replaceFrom = tokenMatch ? from - tokenMatch[0].length : from;
    view.dispatch({
      changes: { from: replaceFrom, to, insert: hint.insert },
      selection: { anchor: replaceFrom + hint.insert.length },
    });
    view.focus();
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        EditorView.lineWrapping,
        queryTheme,
        queryHighlightPlugin,
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onRunRef.current?.();
              return true;
            },
          },
          {
            key: "Tab",
            run: () => {
              const selected = hintsRef.current[Math.max(0, selectedHintIndexRef.current)] ?? hintsRef.current[0];
              if (!selected || !activeTokenRef.current) return false;
              applyHint(selected);
              return true;
            },
          },
          {
            key: "ArrowDown",
            run: () => {
              if (hintsRef.current.length === 0) return false;
              setSelectedHintIndex((prev) => (prev + 1) % hintsRef.current.length);
              return true;
            },
          },
          {
            key: "ArrowUp",
            run: () => {
              if (hintsRef.current.length === 0) return false;
              setSelectedHintIndex((prev) => (prev - 1 + hintsRef.current.length) % hintsRef.current.length);
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          const docText = update.state.doc.toString();
          if (update.docChanged) onChangeRef.current(docText);
          if (update.docChanged || update.selectionSet) {
            const { hints: nextHints, activeToken: nextToken } = deriveQueryHints(
              docText,
              update.state.selection.main.head,
              collectionsRef.current,
            );
            hintsRef.current = nextHints;
            setHints(nextHints);
            setActiveToken(nextToken);
            setSelectedHintIndex(0);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    const initialHintState = deriveQueryHints(value, view.state.selection.main.head, collectionsRef.current);
    hintsRef.current = initialHintState.hints;
    setHints(initialHintState.hints);
    setActiveToken(initialHintState.activeToken);
    setSelectedHintIndex(0);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return (
    <div className="space-y-2">
      <div className={cn("relative", className)}>
        <div
          ref={hostRef}
          className={cn(
            "min-h-[180px] overflow-hidden rounded-xl border border-border/70 bg-background/40 [&_.cm-editor]:outline-none",
            className,
          )}
          role="region"
          aria-label="Data query editor"
        />
        {hints.length > 0 && activeToken ? (
          <div className="pointer-events-none absolute right-3 top-2 rounded border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
            {activeToken}
            <span className="text-muted-foreground/40">{hints[selectedHintIndex]?.label.slice(activeToken.length)}</span>
          </div>
        ) : null}
        {hints.length > 0 && activeToken ? (
          <div className="absolute bottom-2 left-2 right-2 z-20">
            <div className="rounded-lg border border-border/70 bg-background/95 p-1.5 shadow-lg">
              <p className="px-1 text-[10px] text-muted-foreground">Suggestions (Tab accepts, Up/Down changes)</p>
              <div className="mt-1 max-h-32 overflow-auto">
                {hints.map((hint, index) => (
                  <button
                    key={`${hint.label}-${hint.detail}`}
                    type="button"
                    onClick={() => {
                      setSelectedHintIndex(index);
                      applyHint(hint);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2 py-1 text-left text-[11px]",
                      index === selectedHintIndex
                        ? "border border-accent/50 bg-accent/15"
                        : "border border-transparent hover:border-accent/40 hover:bg-muted/40",
                    )}
                  >
                    <span>{hint.label}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{hint.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
