"use client";

/**
 * Opt-in production / preview debugging: uncaught errors, rejections, React render
 * errors, and (optionally) mirrored console output.
 *
 * - NEXT_PUBLIC_CLIENT_DEBUG=1 — dock + window errors + rejections + React boundary
 * - NEXT_PUBLIC_CLIENT_DEBUG_CONSOLE=1 — also mirror console.error / console.warn
 * - NEXT_PUBLIC_CLIENT_DEBUG_VERBOSE=1 — with console on, also mirror console.log / console.info
 *
 * Log lines use an external store + useSyncExternalStore so console.* never drives
 * React setState during render (avoids minified React error #185).
 */

import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Check, Copy } from "lucide-react";
import {
  appendDebugLog,
  clearDebugLog,
  getDebugLogSnapshot,
  getServerDebugLogSnapshot,
  subscribeDebugLog,
  type DebugLine,
} from "./client-debug-log";

const DEBUG_ON = process.env.NEXT_PUBLIC_CLIENT_DEBUG === "1";
const CONSOLE_MIRROR = process.env.NEXT_PUBLIC_CLIENT_DEBUG_CONSOLE === "1";
const VERBOSE = process.env.NEXT_PUBLIC_CLIENT_DEBUG_VERBOSE === "1";

const DOCK_HIDDEN_KEY = "gadClientDebugDockHidden";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

function formatConsoleArg(a: unknown): string {
  if (typeof a === "string") return a;
  if (a instanceof Error) return `${a.message}\n${a.stack ?? ""}`;
  try {
    return JSON.stringify(a, null, 0);
  } catch {
    return String(a);
  }
}

function formatLinesForClipboard(lines: readonly DebugLine[]): string {
  return lines
    .map((l) => {
      const ts = new Date(l.t).toISOString();
      const body = l.detail ? `${l.message}\n${l.detail}` : l.message;
      return `${ts} [${l.kind}] ${body}`;
    })
    .join("\n\n---\n\n");
}

class ClientRenderErrorBoundary extends Component<
  { children: ReactNode; onCatch: (error: Error, info: ErrorInfo) => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onCatch(error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-lg font-semibold text-red-400">React render error</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Details are in the <strong className="text-foreground">Client debug</strong> panel at the bottom of the
            page.
          </p>
          <button
            type="button"
            className="mt-6 rounded-md border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
            onClick={() => this.setState({ hasError: false })}
          >
            Reset error boundary (retry)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function DebugDock({
  lines,
  onRequestHide,
}: {
  lines: readonly DebugLine[];
  onRequestHide: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyFullLog = useCallback(() => {
    const text = formatLinesForClipboard(lines);
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopiedAll(true);
        window.setTimeout(() => setCopiedAll(false), 1600);
      },
      () => {},
    );
  }, [lines]);

  if (collapsed) {
    return (
      <button
        type="button"
        className="fixed bottom-2 right-2 z-[2147483000] rounded-md border border-amber-500/60 bg-black/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400 shadow-lg"
        onClick={() => setCollapsed(false)}
        title="Expand dock · Alt+Shift+D hides completely"
      >
        Client debug ({lines.length})
      </button>
    );
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[2147483000] flex max-h-[min(42vh,28rem)] flex-col border-t-2 border-amber-500/80 bg-zinc-950/98 text-left shadow-[0_-8px_40px_rgba(0,0,0,0.75)] backdrop-blur-sm"
      role="region"
      aria-label="Client debug log"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-900/50 bg-amber-950/40 px-3 py-1.5">
        <span className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wider text-amber-400">
          Client debug · NEXT_PUBLIC_CLIENT_DEBUG=1
          {CONSOLE_MIRROR ? " · console mirror on" : ""}
          {VERBOSE && CONSOLE_MIRROR ? " · verbose" : ""}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[9px] text-zinc-500 sm:inline" title="Keyboard">
            Alt+Shift+D
          </span>
          <span className="tabular-nums text-[10px] text-zinc-500">{lines.length} lines</span>
          <button
            type="button"
            className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
            onClick={() => clearDebugLog()}
          >
            Clear
          </button>
          <button
            type="button"
            className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
            onClick={() => setCollapsed(true)}
          >
            Hide
          </button>
          <button
            type="button"
            className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            onClick={onRequestHide}
            title="Turn off dock (Alt+Shift+D)"
          >
            Off
          </button>
          <button
            type="button"
            onClick={copyFullLog}
            disabled={lines.length === 0}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-600/50 bg-zinc-900/80 text-amber-300 hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-30"
            aria-label="Copy full log to clipboard"
            title="Copy full log"
          >
            {copiedAll ? <Check className="size-4 text-emerald-400" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={2} />}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 font-mono text-[11px] leading-snug">
        {lines.length === 0 ? (
          <p className="text-zinc-500">
            No events yet. Window errors, unhandled rejections, and React render errors appear here.
            {CONSOLE_MIRROR
              ? " Console output is mirrored."
              : " Set NEXT_PUBLIC_CLIENT_DEBUG_CONSOLE=1 to mirror console.error / console.warn."}
          </p>
        ) : (
          lines.map((l, i) => (
            <pre
              key={`${l.t}-${i}`}
              className="mb-2 whitespace-pre-wrap break-all border-b border-zinc-800/80 pb-2 text-zinc-200 last:mb-0 last:border-0"
            >
              <span className="text-zinc-500">{new Date(l.t).toISOString().slice(11, 23)}</span>{" "}
              <span
                className={
                  l.kind === "react" || l.kind === "window"
                    ? "text-red-400"
                    : l.kind === "rejection"
                      ? "text-orange-400"
                      : l.kind === "console-warn"
                        ? "text-amber-300"
                        : "text-zinc-400"
                }
              >
                [{l.kind}]
              </span>{" "}
              {l.message}
              {l.detail ? `\n${l.detail}` : ""}
            </pre>
          ))
        )}
      </div>
    </div>
  );
}

function ClientDebugEnabled({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribeDebugLog, getDebugLogSnapshot, getServerDebugLogSnapshot);
  const [dockHidden, setDockHidden] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(DOCK_HIDDEN_KEY);
      setDockHidden(v === "1");
    } catch {
      setDockHidden(false);
    }
  }, []);

  const persistHidden = useCallback((hidden: boolean) => {
    setDockHidden(hidden);
    try {
      localStorage.setItem(DOCK_HIDDEN_KEY, hidden ? "1" : "0");
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey) return;
      if (e.key !== "d" && e.key !== "D") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setDockHidden((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(DOCK_HIDDEN_KEY, next ? "1" : "0");
        } catch {
          /* noop */
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const push = useCallback((line: Omit<DebugLine, "t">) => {
    appendDebugLog({ ...line, t: Date.now() });
  }, []);

  useEffect(() => {
    const onWindowError = (ev: ErrorEvent) => {
      const stack = ev.error instanceof Error ? ev.error.stack : ev.error ? String(ev.error) : "";
      push({
        kind: "window",
        message: ev.message || "window error",
        detail: [ev.filename && ev.lineno != null ? `${ev.filename}:${ev.lineno}:${ev.colno}` : "", stack]
          .filter(Boolean)
          .join("\n"),
      });
    };

    const onRejection = (ev: PromiseRejectionEvent) => {
      const r = ev.reason;
      const message = r instanceof Error ? r.message : String(r);
      const stack = r instanceof Error ? r.stack ?? "" : "";
      push({ kind: "rejection", message: message || "unhandledrejection", detail: stack });
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [push]);

  useEffect(() => {
    if (!CONSOLE_MIRROR) return;

    const origError = console.error;
    const origWarn = console.warn;
    const origLog = console.log;
    const origInfo = console.info;

    console.error = (...args: unknown[]) => {
      origError.apply(console, args);
      appendDebugLog({
        t: Date.now(),
        kind: "console-error",
        message: args.map(formatConsoleArg).join(" "),
      });
    };
    console.warn = (...args: unknown[]) => {
      origWarn.apply(console, args);
      appendDebugLog({
        t: Date.now(),
        kind: "console-warn",
        message: args.map(formatConsoleArg).join(" "),
      });
    };

    if (VERBOSE) {
      console.log = (...args: unknown[]) => {
        origLog.apply(console, args);
        appendDebugLog({
          t: Date.now(),
          kind: "console-log",
          message: args.map(formatConsoleArg).join(" "),
        });
      };
      console.info = (...args: unknown[]) => {
        origInfo.apply(console, args);
        appendDebugLog({
          t: Date.now(),
          kind: "console-log",
          message: `[info] ${args.map(formatConsoleArg).join(" ")}`,
        });
      };
    }

    return () => {
      console.error = origError;
      console.warn = origWarn;
      if (VERBOSE) {
        console.log = origLog;
        console.info = origInfo;
      }
    };
  }, []);

  const onReactCatch = useCallback(
    (error: Error, info: ErrorInfo) => {
      push({
        kind: "react",
        message: error.message || "componentDidCatch",
        detail: [error.stack, info.componentStack].filter(Boolean).join("\n--- component stack ---\n"),
      });
    },
    [push],
  );

  return (
    <>
      <ClientRenderErrorBoundary onCatch={onReactCatch}>{children}</ClientRenderErrorBoundary>
      {dockHidden ? (
        <button
          type="button"
          className="fixed bottom-4 right-24 z-[2147483000] rounded-md border border-zinc-600 bg-black/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-400 shadow-lg hover:border-amber-600/50 hover:text-amber-300"
          onClick={() => persistHidden(false)}
          title="Show client debug dock (Alt+Shift+D)"
        >
          Debug off
        </button>
      ) : (
        <DebugDock lines={lines} onRequestHide={() => persistHidden(true)} />
      )}
    </>
  );
}

export function ClientDebugShell({ children }: { children: ReactNode }) {
  if (!DEBUG_ON) return <>{children}</>;
  return <ClientDebugEnabled>{children}</ClientDebugEnabled>;
}

export type { DebugLine, DebugLineKind } from "./client-debug-log";
