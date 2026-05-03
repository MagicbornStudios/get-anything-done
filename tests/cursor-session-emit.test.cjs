const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const SCRIPT = path.join(MONOREPO_ROOT, "scripts", "cursor-session-emit.cjs");

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
    "const out = process.stdout;",
    "const prompt = [];",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data', (chunk) => prompt.push(chunk));",
    "process.stdin.on('end', () => {",
    "const lines = [",
    "  { hook_event_name: 'preToolUse', tool_name: 'Read', tool_input: { target_file: 'vendor/get-anything-done/references/session-telemetry-schema.md' }, tool_use_id: 'tool-1' },",
    "  { hook_event_name: 'postToolUse', tool_name: 'Read', tool_input: { target_file: 'vendor/get-anything-done/references/session-telemetry-schema.md' }, tool_output: 'ok', duration: 12, tool_use_id: 'tool-1' },",
    `  { hook_event_name: 'postToolUse', tool_name: 'Bash', tool_input: { command: 'node vendor/get-anything-done/bin/gad.cjs handoffs complete ${handoffId}' }, tool_output: 'ok', duration: 20, tool_use_id: 'tool-2' },`,
    "  { hook_event_name: 'postToolUseFailure', tool_name: 'Edit', tool_input: { target_file: 'scripts/gad-cursor-trial.mjs' }, error_message: 'permission denied', failure_type: 'permission_denied', duration: 7, tool_use_id: 'tool-3' },",
    "  { hook_event_name: 'postToolUse', tool_name: 'Bash', tool_input: { command: 'Get-Content .env' }, tool_output: 'Authorization: Bearer sk-test-super-secret\\nOPENAI_API_KEY=sk-test-super-secret', duration: 9, tool_use_id: 'tool-4' },",
    "];",
    "if (!prompt.join('').includes('Phase 89-04 - cursor-cli adapter for session telemetry.')) throw new Error('prompt not forwarded');",
    "for (const line of lines) out.write(JSON.stringify(line) + '\\n');",
    "});",
  ].join("\n");
  const prompt = [
    "# gad team worker task",
    "",
    `**Handoff ID:** ${handoffId}`,
    "**Project:** global",
    "",
    "Body:",
    "",
    "Phase 89-04 - cursor-cli adapter for session telemetry.",
  ].join("\n");

  execFileSync(process.execPath, [
    SCRIPT,
    "--agent",
    "team-w4",
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
    input: prompt,
    env: { ...process.env, GAD_SESSION_TRACE_VERBOSE: "1" },
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
  });

  const events = readJsonl(path.join(sessionRoot, sessionId, "events.jsonl"));
  assert.equal(events[0].kind, "session-start");
  assert.equal(events[0].runtime, "cursor-cli");
  assert.equal(events[0].claimed_handoff, handoffId);
  assert.equal(events[1].kind, "step-start");
  assert.ok(events.some((event) => event.kind === "tool-call" && event.tool === "Read" && event.ok === true));
  assert.ok(events.some((event) => event.kind === "tool-call" && event.tool === "Edit" && event.ok === false));
  const scrubbed = events.find((event) => event.kind === "tool-call" && event.target === "Get-Content .env");
  assert.ok(scrubbed && scrubbed.output_excerpt, "verbose output excerpt emitted");
  assert.ok(!scrubbed.output_excerpt.includes("sk-test-super-secret"), "output excerpt scrubbed");
  assert.ok(events.some((event) => event.kind === "pressure-event" && event.category === "hook-block"));
  assert.ok(events.some((event) => event.kind === "attribution-link" && event.artifact_id === handoffId));
  assert.equal(events.at(-1).kind, "session-end");
});
