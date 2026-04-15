"use client";

import { useEffect, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type ViewUpdate, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { cn } from "@/lib/utils";
import { QUERY_FIELDS, QUERY_KEYWORDS, QUERY_OPERATORS, QUERY_TRUST_VALUES } from "./query";

const QUERY_KEYWORDS_PATTERN = /\b(FROM|WHERE|AND|SORT|LIMIT|SELECT|ASC|DESC)\b/gi;
const QUERY_OPERATORS_PATTERN = /(>=|<=|!=|=|:|>|<)/g;
const QUERY_FIELD_NAMES_PATTERN = /\b(id|surface|number|source|formula|trust|page|notes|sourceLength|formulaLength|notesLength)\b/g;

type QueryHint = {
  label: string;
  insert: string;
  detail: string;
};

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

function deriveQueryHints(docText: string, cursorPos: number, collections: string[]): QueryHint[] {
  const uniqueCollections = [...new Set(["active", ...collections.map((name) => name.toLowerCase())])];
  const lineStartsAt = docText.lastIndexOf("\n", Math.max(0, cursorPos - 1)) + 1;
  const lineText = docText.slice(lineStartsAt, cursorPos);
  const tokenMatch = lineText.match(/[A-Za-z_][\w-]*$/);
  const token = tokenMatch?.[0]?.toLowerCase() ?? "";
  const upperPrefix = lineText.toUpperCase();
  const filterHints = (hints: QueryHint[]) =>
    token ? hints.filter((hint) => hint.label.toLowerCase().startsWith(token)) : hints;

  if (upperPrefix.startsWith("FROM ")) {
    return filterHints(uniqueCollections.map((name) => ({ label: name, insert: name, detail: "collection" }))).slice(
      0,
      8,
    );
  }

  if (upperPrefix.startsWith("SORT ")) {
    const sortParts = lineText.trim().split(/\s+/);
    if (sortParts.length <= 2) {
      return filterHints(
        QUERY_FIELDS.map((field) => ({
          label: field,
          insert: field,
          detail: "field",
        })),
      ).slice(0, 10);
    }
    return filterHints([
      { label: "asc", insert: "asc", detail: "ascending" },
      { label: "desc", insert: "desc", detail: "descending" },
    ]);
  }

  if (upperPrefix.startsWith("SELECT ")) {
    return filterHints(
      QUERY_FIELDS.map((field) => ({
        label: field,
        insert: field,
        detail: "field",
      })),
    ).slice(0, 10);
  }

  if (upperPrefix.startsWith("WHERE ") || upperPrefix.includes(" AND ")) {
    const trustNeedsValue = /(?:^|\s)trust(?:>=|<=|!=|=|:|>|<)$/.test(lineText);
    if (trustNeedsValue) {
      return filterHints(
        QUERY_TRUST_VALUES.map((value) => ({
          label: value,
          insert: value,
          detail: "trust value",
        })),
      );
    }
    return filterHints([
      ...QUERY_FIELDS.map((field) => ({ label: field, insert: field, detail: "field" })),
      ...QUERY_OPERATORS.map((operator) => ({ label: operator, insert: operator, detail: "operator" })),
      { label: "AND", insert: "AND", detail: "combine clauses" },
    ]).slice(0, 12);
  }

  return filterHints(QUERY_KEYWORDS.map((keyword) => ({ label: keyword, insert: keyword, detail: "keyword" }))).slice(
    0,
    8,
  );
}

export default function DataQueryEditor({ value, onChange, onRun, className, collections = [] }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  const collectionsRef = useRef(collections);
  const [hints, setHints] = useState<QueryHint[]>([]);
  const hintsRef = useRef<QueryHint[]>([]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  useEffect(() => {
    collectionsRef.current = collections;
    const view = viewRef.current;
    if (!view) return;
    const nextHints = deriveQueryHints(view.state.doc.toString(), view.state.selection.main.head, collections);
    hintsRef.current = nextHints;
    setHints(nextHints);
  }, [collections]);

  const applyHint = (hint: QueryHint) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    const prefix = line.text.slice(0, from - line.from);
    const tokenMatch = prefix.match(/[A-Za-z_][\w-]*$/);
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
              const first = hintsRef.current[0];
              if (!first) return false;
              applyHint(first);
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          const docText = update.state.doc.toString();
          if (update.docChanged) onChangeRef.current(docText);
          if (update.docChanged || update.selectionSet) {
            const nextHints = deriveQueryHints(docText, update.state.selection.main.head, collectionsRef.current);
            hintsRef.current = nextHints;
            setHints(nextHints);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    const initialHints = deriveQueryHints(value, view.state.selection.main.head, collectionsRef.current);
    hintsRef.current = initialHints;
    setHints(initialHints);

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
      <div
        ref={hostRef}
        className={cn(
          "min-h-[180px] overflow-hidden rounded-xl border border-border/70 bg-background/40 [&_.cm-editor]:outline-none",
          className,
        )}
        role="region"
        aria-label="Data query editor"
      />
      <div className="rounded-lg border border-border/60 bg-muted/20 p-2">
        <p className="text-[11px] text-muted-foreground">Suggestions (Tab inserts first)</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {hints.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">No suggestions for this cursor position.</span>
          ) : (
            hints.map((hint) => (
              <button
                key={`${hint.label}-${hint.detail}`}
                type="button"
                onClick={() => applyHint(hint)}
                className="rounded-md border border-border/70 bg-background/70 px-2 py-1 text-[11px] hover:border-accent/60"
              >
                {hint.label}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
