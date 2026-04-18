"use client";

/**
 * Global keyboard shortcut cheatsheet.
 *
 * Press `?` (or Shift+/) to open a modal listing every site-wide keyboard
 * shortcut. Escape closes. The modal is a plain overlay — no shadcn Dialog
 * dep needed — styled to match the site and dismissable by backdrop click.
 *
 * The shortcut list itself comes from `devid-shortcut-registry.ts`; this
 * component is purely a display + mount point for the global toggle listener.
 * That keeps the cheatsheet and the DevId provider's actual key handler in
 * lockstep — adding a new shortcut is one entry in the registry and both
 * surfaces pick it up.
 */

import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";
import {
  getVisibleShortcuts,
  matchShortcut,
} from "./devid-shortcut-registry";

export function KeyboardShortcutsProvider() {
  const [open, setOpen] = useState(false);
  const shortcuts = getVisibleShortcuts();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /**
       * Fast path: only `?`, `/` (combined with Shift), and `Escape` drive
       * any branch here. Plain typing short-circuits before the
       * editable-target check, which is the expensive bit on every keypress.
       */
      if (e.key !== "?" && e.key !== "/" && e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTyping) return;

      if (matchShortcut(e, "cheatsheet.toggle")) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (matchShortcut(e, "devid.escape")) {
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
              {shortcuts.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs leading-5 text-foreground">{s.label}</p>
                    {s.when ? (
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {s.when}
                      </p>
                    ) : null}
                  </div>
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
