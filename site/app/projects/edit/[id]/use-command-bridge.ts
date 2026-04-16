import { useCallback, useRef, useState } from "react";

type LogLine = { stream: "stdout" | "stderr" | "meta"; text: string };

type BridgeState =
  | { kind: "idle" }
  | { kind: "running"; lines: LogLine[] }
  | { kind: "done"; lines: LogLine[]; code: number | null }
  | { kind: "error"; lines: LogLine[]; message: string };

type RunOpts = {
  subcommand: string;
  args?: string[];
  projectId?: string;
};

export function useCommandBridge() {
  const [state, setState] = useState<BridgeState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (opts: RunOpts) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const lines: LogLine[] = [];
    setState({ kind: "running", lines });

    try {
      const res = await fetch("/api/dev/command-bridge", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify(opts),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        setState({ kind: "error", lines, message: text });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          const dataLine = part
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(6));
            if (payload.line != null) {
              const eventLine = part.split("\n").find((l) => l.startsWith("event: "));
              const stream = eventLine?.slice(7) === "stderr" ? "stderr" : "stdout";
              lines.push({ stream, text: payload.line });
              setState({ kind: "running", lines: [...lines] });
            }
            if (payload.code !== undefined) {
              setState({ kind: "done", lines: [...lines], code: payload.code });
            }
            if (payload.message) {
              setState({ kind: "error", lines: [...lines], message: payload.message });
            }
          } catch {
            // skip malformed SSE
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setState({ kind: "error", lines, message: (e as Error).message });
      }
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { state, run, abort };
}
