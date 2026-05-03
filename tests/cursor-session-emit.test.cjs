const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const SCRIPT = path.join(MONOREPO_ROOT, "scripts", "cursor-session-emit.mjs");

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("cursor-session-emit writes session telemetry from synthetic hook payloads", () => {
  const sessionRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-session-emit-"));
  const sessionId = "s-20260502-deadbeef";
  const handoffId = "h-2026-05-03T01-13-47-global-89";
  const childProgram = [
    "const lines = [",
    "  { hook_event_name: 'preToolUse', tool_name: 'Read', tool_input: { target_file: 'vendor/get-anything-done/references/session-telemetry-schema.md' }, tool_use_id: 'tool-1' },",
    "  { hook_event_name: 'postToolUse', tool_name: 'Read', tool_input: { target_file: 'vendor/get-anything-done/references/session-telemetry-schema.md' }, tool_output: 'ok', duration: 12, tool_use_id: 'tool-1' },",
    `  { hook_event_name: 'postToolUse', tool_name: 'Bash', tool_input: { command: 'node vendor/get-anything-done/bin/gad.cjs handoffs complete ${handoffId}' }, tool_output: 'ok', duration: 20, tool_use_id: 'tool-2' },`,
    "  { hook_event_name: 'postToolUseFailure', tool_name: 'Edit', tool_input: { target_file: 'scripts/gad-cursor-trial.mjs' }, error_message: 'permission denied', failure_type: 'permission_denied', duration: 7, tool_use_id: 'tool-3' },",
    "];",
    "for (const line of lines) process.stdout.write(JSON.stringify(line) + '\\n');",
  ].join("\n");

  execFileSync(process.execPath, [
    SCRIPT,
    "--projectid",
    "global",
    "--intent",
    "Emit a fixture cursor session",
    "--runtime",
    "cursor",
    "--agent",
    "team-w4",
    "--claimed-handoff",
    handoffId,
    "--session-id",
    sessionId,
    "--session-root",
    sessionRoot,
    "--",
    process.execPath,
    "-e",
    childProgram,
  ], {
    cwd: MONOREPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });

  const events = readJsonl(path.join(sessionRoot, sessionId, "events.jsonl"));
  assert.equal(events[0].kind, "session-start");
  assert.equal(events[1].kind, "step-start");
  assert.ok(events.some((event) => event.kind === "tool-call" && event.tool === "Read" && event.ok === true));
  assert.ok(events.some((event) => event.kind === "tool-call" && event.tool === "Edit" && event.ok === false));
  assert.ok(events.some((event) => event.kind === "pressure-event" && event.category === "hook-block"));
  assert.ok(events.some((event) => event.kind === "attribution-link" && event.artifact_id === handoffId));
  assert.equal(events.at(-1).kind, "session-end");
});
