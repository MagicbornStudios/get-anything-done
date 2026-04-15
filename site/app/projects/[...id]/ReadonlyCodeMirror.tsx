"use client";

import { useEffect, useMemo, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { basicSetup } from "codemirror";
import { cn } from "@/lib/utils";

/** Matches `.cm-scroller` font metrics — scroll inside the editor after this viewport. */
export const READONLY_CM_FONT_PX = 12;
export const READONLY_CM_LINE_HEIGHT = 1.45;
export const READONLY_CM_VISIBLE_LINES = 24;
export const READONLY_CM_MAX_HEIGHT_PX =
  READONLY_CM_FONT_PX * READONLY_CM_LINE_HEIGHT * READONLY_CM_VISIBLE_LINES;

/** Pixel height for a given line count (same metrics as the editor). */
export function readonlyCmHeightForLines(lineCount: number): number {
  return READONLY_CM_FONT_PX * READONLY_CM_LINE_HEIGHT * lineCount;
}

function createDarkChrome(minVisibleLines: number | undefined, maxVisibleLines: number) {
  const maxPx = readonlyCmHeightForLines(maxVisibleLines);
  const minPx =
    minVisibleLines != null ? readonlyCmHeightForLines(minVisibleLines) : undefined;
  return EditorView.theme(
    {
      "&": {
        backgroundColor: "transparent",
        maxHeight: `${maxPx}px`,
        ...(minPx != null ? { minHeight: `${minPx}px` } : {}),
        height: "auto",
      },
      ".cm-scroller": {
        fontFamily: "ui-monospace, monospace",
        fontSize: `${READONLY_CM_FONT_PX}px`,
        lineHeight: READONLY_CM_LINE_HEIGHT,
        maxHeight: `${maxPx}px`,
        minHeight: minPx != null ? `${minPx}px` : 0,
        overflow: "auto",
      },
      ".cm-gutters": {
        backgroundColor: "rgb(15 23 42 / 0.5)",
        borderRight: "1px solid rgb(51 65 85 / 0.5)",
        color: "rgb(148 163 184)",
      },
      ".cm-activeLineGutter": { backgroundColor: "rgb(30 41 59 / 0.6)" },
      ".cm-content": { caretColor: "rgb(226 232 240)" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "rgb(226 232 240)" },
    },
    { dark: true },
  );
}

export function ReadonlyCodeMirror({
  value,
  className,
  /** Minimum viewport height in lines (e.g. 20 in modals). */
  minVisibleLines,
  /** Maximum scroll viewport in lines before inner scroll. Defaults to 24. */
  maxVisibleLines = READONLY_CM_VISIBLE_LINES,
}: {
  value: string;
  className?: string;
  minVisibleLines?: number;
  maxVisibleLines?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const chrome = useMemo(
    () => createDarkChrome(minVisibleLines, maxVisibleLines),
    [minVisibleLines, maxVisibleLines],
  );
  const maxPx = useMemo(() => readonlyCmHeightForLines(maxVisibleLines), [maxVisibleLines]);
  const minPx =
    minVisibleLines != null ? readonlyCmHeightForLines(minVisibleLines) : undefined;

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        chrome,
      ],
    });
    const view = new EditorView({ state, parent: host.current });
    return () => {
      view.destroy();
    };
  }, [value, chrome]);

  return (
    <div
      ref={host}
      className={cn(
        "w-full overflow-hidden rounded-lg border border-border/60",
        className,
      )}
      style={{
        maxHeight: maxPx,
        ...(minPx != null ? { minHeight: minPx } : {}),
      }}
    />
  );
}
