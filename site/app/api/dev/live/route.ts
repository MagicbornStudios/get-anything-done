import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Live planning data SSE stream.
 *
 * Watches .planning/ for file changes and pushes events to the browser.
 * Also tracks change patterns to infer agent presence:
 *   - Multiple TASK-REGISTRY.xml writes within a short window = multiple agents
 *   - Different phase IDs changing concurrently = different work areas
 *
 * GET /api/dev/live — SSE stream
 * GET /api/dev/live?snapshot=1 — one-shot current state (no stream)
 */

type ChangeEvent = {
  file: string;
  event: "change" | "rename";
  timestamp: number;
  size?: number;
};

type AgentSignal = {
  id: string;
  lastSeen: number;
  files: string[];
  inferredPhase: string | null;
};

// In-memory change log — shared across connections
const recentChanges: ChangeEvent[] = [];
const MAX_CHANGES = 200;

// Agent inference state
const agentSignals = new Map<string, AgentSignal>();

function inferPhaseFromFile(content: string, filename: string): string | null {
  // Look for phase references in the changed content
  if (filename.includes("TASK-REGISTRY")) {
    const match = content.match(/status="(?:in-progress|done)"[^>]*>.*?phase[^\d]*(\d+\.?\d*)/i);
    if (match) return match[1];
  }
  if (filename.includes("STATE")) {
    const match = content.match(/<current-phase>([^<]+)<\/current-phase>/);
    if (match) return match[1];
  }
  return null;
}

function detectAgentPresence(changes: ChangeEvent[]): AgentSignal[] {
  // Group changes into time windows (5s clusters)
  const now = Date.now();
  const recent = changes.filter((c) => now - c.timestamp < 30000); // last 30s
  if (recent.length === 0) return [];

  // Cluster by time proximity — changes within 2s of each other are likely same agent
  const clusters: ChangeEvent[][] = [];
  let currentCluster: ChangeEvent[] = [recent[0]];

  for (let i = 1; i < recent.length; i++) {
    if (recent[i].timestamp - recent[i - 1].timestamp < 2000) {
      currentCluster.push(recent[i]);
    } else {
      clusters.push(currentCluster);
      currentCluster = [recent[i]];
    }
  }
  clusters.push(currentCluster);

  // Each cluster with distinct file patterns might be a different agent
  return clusters.map((cluster, i) => ({
    id: `agent-${i}`,
    lastSeen: Math.max(...cluster.map((c) => c.timestamp)),
    files: [...new Set(cluster.map((c) => c.file))],
    inferredPhase: null, // filled by caller if needed
  }));
}

function getCurrentState(planDir: string) {
  const state: Record<string, unknown> = {};

  // Read STATE.xml summary
  const statePath = path.join(planDir, "STATE.xml");
  if (fs.existsSync(statePath)) {
    const content = fs.readFileSync(statePath, "utf8");
    const phase = content.match(/<current-phase>([^<]+)<\/current-phase>/)?.[1];
    const status = content.match(/<status>([^<]+)<\/status>/)?.[1];
    const milestone = content.match(/<milestone>([^<]+)<\/milestone>/)?.[1];
    state.phase = phase;
    state.status = status;
    state.milestone = milestone;
  }

  // Count tasks by status
  const taskPath = path.join(planDir, "TASK-REGISTRY.xml");
  if (fs.existsSync(taskPath)) {
    const content = fs.readFileSync(taskPath, "utf8");
    const planned = (content.match(/status="planned"/g) || []).length;
    const inProgress = (content.match(/status="in-progress"/g) || []).length;
    const done = (content.match(/status="done"/g) || []).length;
    state.tasks = { planned, inProgress, done, total: planned + inProgress + done };
  }

  // Count decisions
  const decPath = path.join(planDir, "DECISIONS.xml");
  if (fs.existsSync(decPath)) {
    const content = fs.readFileSync(decPath, "utf8");
    state.decisions = (content.match(/<decision /g) || []).length;
  }

  // File mod times
  const files = ["STATE.xml", "TASK-REGISTRY.xml", "DECISIONS.xml", "ROADMAP.xml"];
  state.fileTimes = {};
  for (const f of files) {
    const p = path.join(planDir, f);
    if (fs.existsSync(p)) {
      (state.fileTimes as Record<string, number>)[f] = fs.statSync(p).mtimeMs;
    }
  }

  return state;
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Dev-only endpoint.", { status: 403 });
  }

  const url = new URL(request.url);
  const siteDir = process.cwd();
  const repoRoot = path.resolve(siteDir, "..");
  const planDir = path.join(repoRoot, ".planning");

  // One-shot snapshot mode
  if (url.searchParams.get("snapshot") === "1") {
    const state = getCurrentState(planDir);
    const agents = detectAgentPresence(recentChanges);
    return new Response(
      JSON.stringify({ state, agents, recentChanges: recentChanges.slice(-20) }),
      { headers: { "content-type": "application/json" } },
    );
  }

  // SSE stream mode
  const encoder = new TextEncoder();
  let watcherCleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Controller closed
        }
      };

      // Send initial state
      const state = getCurrentState(planDir);
      send("state", state);

      // Watch .planning/ for changes
      const watchers: fs.FSWatcher[] = [];
      const watchFiles = ["STATE.xml", "TASK-REGISTRY.xml", "DECISIONS.xml", "ROADMAP.xml"];

      for (const file of watchFiles) {
        const filePath = path.join(planDir, file);
        if (!fs.existsSync(filePath)) continue;

        try {
          const watcher = fs.watch(filePath, (eventType) => {
            const change: ChangeEvent = {
              file,
              event: eventType as "change" | "rename",
              timestamp: Date.now(),
            };

            try {
              change.size = fs.statSync(filePath).size;
            } catch {
              // File might be mid-write
            }

            recentChanges.push(change);
            if (recentChanges.length > MAX_CHANGES) {
              recentChanges.splice(0, recentChanges.length - MAX_CHANGES);
            }

            // Push the change event
            send("change", change);

            // Push refreshed state
            try {
              const freshState = getCurrentState(planDir);
              send("state", freshState);
            } catch {
              // Ignore read errors during concurrent writes
            }

            // Push agent presence inference
            const agents = detectAgentPresence(recentChanges);
            if (agents.length > 0) {
              send("agents", agents);
            }
          });
          watchers.push(watcher);
        } catch {
          // Watch setup failed — file might not exist
        }
      }

      // Also watch the gad-log for CLI activity
      const logDir = path.join(planDir, ".gad-log");
      if (fs.existsSync(logDir)) {
        try {
          const logWatcher = fs.watch(logDir, (eventType, filename) => {
            if (!filename || !filename.endsWith(".jsonl")) return;
            send("cli-activity", {
              file: `.gad-log/${filename}`,
              event: eventType,
              timestamp: Date.now(),
            });
          });
          watchers.push(logWatcher);
        } catch {
          // Log dir watch failed
        }
      }

      // Heartbeat every 15s to keep connection alive
      const heartbeat = setInterval(() => {
        send("heartbeat", { timestamp: Date.now() });
      }, 15000);

      watcherCleanup = () => {
        clearInterval(heartbeat);
        for (const w of watchers) {
          try { w.close(); } catch { /* ignore */ }
        }
      };

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        watcherCleanup?.();
        try { controller.close(); } catch { /* ignore */ }
      });
    },
    cancel() {
      watcherCleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
