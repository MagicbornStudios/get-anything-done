"use client";

/**
 * Opt-in production / preview debugging: uncaught errors, rejections, React render
 * errors, and mirrored console output surface in a fixed dock when enabled at build time.
 *
 * Enable on Vercel: NEXT_PUBLIC_CLIENT_DEBUG=1 (redeploy). Optional verbose logs:
 * NEXT_PUBLIC_CLIENT_DEBUG_VERBOSE=1
 */

import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

const DEBUG_ON = process.env.NEXT_PUBLIC_CLIENT_DEBUG === "1";
const VERBOSE = process.env.NEXT_PUBLIC_CLIENT_DEBUG_VERBOSE === "1";

export type DebugLineKind =
  | "window"
  | "rejection"
  | "react"
  | "console-error"
  | "console-warn"
  | "console-log";

export type DebugLine = {
  t: number;
  kind: DebugLineKind;
  message: string;
  detail?: string;
};

function formatConsoleArg(a: unknown): string {
  if (typeof a === "string") return a;
  if (a instanceof Error) return `${a.message}\n${a.stack ?? ""}`;
  try {
    return JSON.stringify(a, null, 0);
  } catch {
    return String(a);
  }
}

function pushToWindowExport(line: DebugLine) {
  if (typeof window === "undefined") return;
  const w = window as Window & { __GAD_DEBUG_LINES?: DebugLine[] };
  const prev = w.__GAD_DEBUG_LINES ?? [];
  w.__GAD_DEBUG_LINES = [...prev.slice(-199), line];
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

function DebugDock({ lines, onClear }: { lines: DebugLine[]; onClear: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  if (collapsed) {
    return (
      <button
        type="button"
        className="fixed bottom-2 right-2 z-[2147483000] rounded-md border border-amber-500/60 bg-black/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400 shadow-lg"
        onClick={() => setCollapsed(false)}
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
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
          Client debug · NEXT_PUBLIC_CLIENT_DEBUG=1
          {VERBOSE ? " · verbose console" : ""}
        </span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-[10px] text-muted-foreground">{lines.length} lines</span>
          <button
            type="button"
            className="rounded border border-zinc-600 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
            onClick={onClear}
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
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 font-mono text-[11px] leading-snug">
        {lines.length === 0 ? (
          <p className="text-zinc-500">No events yet. Errors, rejections, and console output appear here.</p>
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
  const [lines, setLines] = useState<DebugLine[]>([]);

  const push = useCallback((line: Omit<DebugLine, "t">) => {
    const full: DebugLine = { ...line, t: Date.now() };
    pushToWindowExport(full);
    setLines((prev) => [...prev.slice(-199), full]);
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
    const origError = console.error;
    const origWarn = console.warn;
    const origLog = console.log;
    const origInfo = console.info;

    console.error = (...args: unknown[]) => {
      origError.apply(console, args);
      push({ kind: "console-error", message: args.map(formatConsoleArg).join(" ") });
    };
    console.warn = (...args: unknown[]) => {
      origWarn.apply(console, args);
      push({ kind: "console-warn", message: args.map(formatConsoleArg).join(" ") });
    };

    if (VERBOSE) {
      console.log = (...args: unknown[]) => {
        origLog.apply(console, args);
        push({ kind: "console-log", message: args.map(formatConsoleArg).join(" ") });
      };
      console.info = (...args: unknown[]) => {
        origInfo.apply(console, args);
        push({ kind: "console-log", message: `[info] ${args.map(formatConsoleArg).join(" ")}` });
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
  }, [push]);

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
      <DebugDock lines={lines} onClear={() => setLines([])} />
    </>
  );
}

export function ClientDebugShell({ children }: { children: ReactNode }) {
  if (!DEBUG_ON) return <>{children}</>;
  return <ClientDebugEnabled>{children}</ClientDebugEnabled>;
}
