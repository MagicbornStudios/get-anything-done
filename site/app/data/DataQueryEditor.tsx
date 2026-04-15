"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type ViewUpdate, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { cn } from "@/lib/utils";

const QUERY_KEYWORDS = /\b(FROM|WHERE|AND|SORT|LIMIT|SELECT|ASC|DESC)\b/gi;
const QUERY_OPERATORS = /(>=|<=|!=|=|:|>|<)/g;
const QUERY_FIELD_NAMES = /\b(id|surface|number|source|formula|trust|page|notes|sourceLength|formulaLength|notesLength)\b/g;

function buildDecorations(view: EditorView) {
  const decorations = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);

    for (const match of text.matchAll(QUERY_KEYWORDS)) {
      if (match.index == null) continue;
      const start = from + match.index;
      decorations.push(Decoration.mark({ class: "cm-query-keyword" }).range(start, start + match[0].length));
    }

    for (const match of text.matchAll(QUERY_FIELD_NAMES)) {
      if (match.index == null) continue;
      const start = from + match.index;
      decorations.push(Decoration.mark({ class: "cm-query-field" }).range(start, start + match[0].length));
    }

    for (const match of text.matchAll(QUERY_OPERATORS)) {
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
};

export default function DataQueryEditor({ value, onChange, onRun, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

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
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;

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
    <div
      ref={hostRef}
      className={cn(
        "min-h-[180px] overflow-hidden rounded-xl border border-border/70 bg-background/40 [&_.cm-editor]:outline-none",
        className,
      )}
      role="region"
      aria-label="Data query editor"
    />
  );
}
