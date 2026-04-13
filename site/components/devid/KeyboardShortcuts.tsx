"use client";

/**
 * Global keyboard shortcut cheatsheet.
 *
 * Press ? (or Shift+/) to open a modal listing every site-wide keyboard
 * shortcut. Escape closes. The modal is a plain overlay — no shadcn Dialog
 * dep needed — styled to match the site and dismissable by backdrop click.
 *
 * Shortcuts registered here are ONLY the cross-site ones (DevId toggle,
 * this cheatsheet itself, escape-to-clear). Page-local shortcuts should
 * stay local to their pages.
 */

import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";

interface Shortcut {
  keys: string[];
  label: string;
  when?: string;
}

const CLIENT_DEBUG_ON = process.env.NEXT_PUBLIC_CLIENT_DEBUG === "1";

const SHORTCUTS: Shortcut[] = [
  { keys: ["?"], label: "Open this keyboard shortcut reference" },
  { keys: ["Alt", "I"], label: "Toggle component IDs overlay" },
  { keys: ["Alt", "click"], label: "Copy component ID + highlight (when DevIds on)" },
  ...(CLIENT_DEBUG_ON
    ? [{ keys: ["Alt", "Shift", "D"], label: "Show / hide client debug dock (remembers for this browser)" }]
    : []),
  { keys: ["Esc"], label: "Close panels / clear highlight / close this sheet" },
];

export function KeyboardShortcutsProvider() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // `?` or `shift+/` — do not intercept when typing in an input/textarea
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Small persistent pill in the bottom-right as a discovery hint */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[9998] inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shadow-lg backdrop-blur transition-colors hover:border-accent/60 hover:text-accent"
        aria-label="Show keyboard shortcuts"
      >
        <Keyboard size={11} />
        <span>?</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border/60 bg-card/95 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Reference
                </p>
                <h2 className="text-lg font-semibold text-foreground">
                  Keyboard shortcuts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <ul className="space-y-2">
              {SHORTCUTS.map((s) => (
                <li
                  key={s.label}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
                >
                  <span className="text-xs leading-5 text-foreground">{s.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {s.keys.map((k, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <kbd className="rounded border border-border/60 bg-card px-1.5 py-0.5 font-mono text-[10px] text-accent">
                          {k}
                        </kbd>
                        {i < s.keys.length - 1 && (
                          <span className="text-[10px] text-muted-foreground">+</span>
                        )}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[10px] text-muted-foreground">
              Press <kbd className="rounded bg-card px-1 font-mono">Esc</kbd> or click
              outside to close.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
