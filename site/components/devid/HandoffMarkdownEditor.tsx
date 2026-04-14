"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { basicSetup, EditorView } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { cn } from "@/lib/utils";

export type HandoffEditorHandle = {
  insertAtCaret: (transcript: string) => void;
  focus: () => void;
};

type Props = {
  /** Initial document; remount the editor (parent `key`) when this must reset. */
  initialDoc: string;
  onChange: (doc: string) => void;
  className?: string;
  ariaLabel: string;
  /**
   * Exact markdown heading text (no trailing newline). After mount, caret moves to the
   * start of the empty line directly under this heading (heading must be followed by `\n\n`).
   */
  focusEmptyLineUnderHeading?: string;
};

const handoffEditorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      maxHeight: "100%",
      fontSize: "13px",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "transparent",
    },
    // Minimum viewport ≈ 30 text lines (uses `lh` from this scroller’s line-height + font size).
    ".cm-scroller": {
      flex: "1 1 0%",
      minHeight: "max(30lh, 20rem)",
      overflow: "auto",
      fontFamily: "var(--font-mono, ui-monospace, monospace)",
      lineHeight: "1.65",
    },
    ".cm-content": {
      caretColor: "var(--foreground)",
      color: "var(--foreground)",
      paddingBlock: "12px",
      paddingInline: "4px 12px",
    },
    ".cm-line": { padding: "0 2px" },
    ".cm-gutters": {
      backgroundColor: "color-mix(in oklch, var(--muted) 35%, transparent)",
      borderRight: "1px solid var(--border)",
      color: "var(--muted-foreground)",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent" },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in oklch, var(--accent) 10%, transparent)",
    },
    ".cm-selectionBackground": {
      background: "color-mix(in oklch, var(--accent) 22%, transparent) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      background: "color-mix(in oklch, var(--accent) 28%, transparent) !important",
    },
    ".cm-cursor": { borderLeftColor: "var(--foreground)" },
    ".cm-comment": { color: "var(--muted-foreground)", fontStyle: "italic" },
    ".cm-string": { color: "oklch(0.78 0.11 150)" },
    ".cm-link": { color: "var(--accent)", textDecoration: "underline" },
    ".cm-heading": { color: "oklch(0.86 0.07 230)", fontWeight: "600" },
    ".cm-keyword": { color: "oklch(0.78 0.14 300)" },
    ".cm-meta": { color: "oklch(0.62 0.04 250)" },
    ".cm-strong": { color: "oklch(0.88 0.09 85)", fontWeight: "700" },
    ".cm-emphasis": { color: "oklch(0.82 0.06 310)", fontStyle: "italic" },
    ".cm-monospace": { color: "oklch(0.82 0.08 20)" },
    ".cm-formatting-list, .cm-formatting-quote": { color: "var(--muted-foreground)" },
  },
  { dark: true },
);

function caretOnEmptyLineAfterHeading(doc: string, heading: string): number | null {
  const idx = doc.indexOf(heading);
  if (idx < 0) return null;
  const nl = idx + heading.length;
  if (doc[nl] !== "\n" || doc[nl + 1] !== "\n") return null;
  return nl + 1;
}

export const HandoffMarkdownEditor = forwardRef<HandoffEditorHandle, Props>(function HandoffMarkdownEditor(
  { initialDoc, onChange, className, ariaLabel, focusEmptyLineUnderHeading },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useImperativeHandle(ref, () => ({
    insertAtCaret(transcript: string) {
      const view = viewRef.current;
      if (!view || !transcript.trim()) return;
      const chunk = transcript.trim() + (transcript.trim().endsWith(" ") ? "" : " ");
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: chunk },
        selection: { anchor: from + chunk.length },
        scrollIntoView: true,
      });
    },
    focus() {
      viewRef.current?.focus();
    },
  }));

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) return;

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        handoffEditorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent });
    viewRef.current = view;

    if (focusEmptyLineUnderHeading) {
      const pos = caretOnEmptyLineAfterHeading(initialDoc, focusEmptyLineUnderHeading);
      if (pos != null) {
        requestAnimationFrame(() => {
          view.focus();
          view.dispatch({
            selection: { anchor: pos, head: pos },
            scrollIntoView: true,
          });
        });
      }
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once; parent remounts via `key` when doc resets
  }, []);

  return (
    <div
      ref={hostRef}
      className={cn("h-full min-h-0 flex-1 overflow-hidden [&_.cm-editor]:h-full [&_.cm-editor]:outline-none", className)}
      role="region"
      aria-label={ariaLabel}
    />
  );
});
