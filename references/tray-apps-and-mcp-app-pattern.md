# Tray apps + MCP-app pattern — operator usage + LLM training reference

Canonical doc for: how operator (human) uses each focused tray-app /
MCP-component, what inputs each takes, what outputs each emits, the
exact CLI shape, and the corresponding training-tuple format so our
SLMs / LLMs can learn to invoke them too.

Each entry below is structured for both:
- **human read** — operator wants to know "what's the BYOK form?"
- **SLM training** — `prompt → tool_call → tool_result` shape suitable
  for SFT corpus emission via `gad provenance sft-export` (phase 153)

## 1. Pattern fundamentals

```
TRAY APP            small, focused, ONE-purpose UI surface
                    no full shell required to launch
                    closes itself when done

MCP TOOL            the chat-callable handle to the tray app
                    LLM invokes it; result renders inline OR opens
                    a transient window (per manifest's surface enum)

THE GOAL            operator says "I need X" → ONE small surface
                    appears for X → operator does the thing → done
                    no chrome, no nav, no ambient dashboards
```

Reference architecture:
- `gad ask <kind>` — phase 158, browser-popup forms (one-purpose)
- `gad mcp serve` — phase 157/161, MCP server with tool registry
- assistant-ui Tools() inline render — phase 162, chat-side render
- Tauri transient window — phase 163, frameless one-component window
- BYOK substrate — phase 134-ish, encrypted secrets per project

## 2. Operator-facing tray apps (CLI invocation)

### 2.1 `gad ask byok` — capture an API key for the active project

| | |
|---|---|
| Trigger | Operator needs to give Kael / agents access to a provider |
| Surface | Small browser popup form (HTML, served on ephemeral local port) |
| Inputs (operator submits) | `provider` (anthropic/openai/openrouter/...), `key_name` (env var name like `ANTHROPIC_API_KEY`), `value` (echoless paste field) |
| Output (file) | `.gad/secrets/<projectid>.enc` — AES-256-GCM, master key in OS keychain via PBKDF2 |
| Output (stdout) | One JSON line: `{"ok":true, "key":"ANTHROPIC_API_KEY", "version":1, "provider":"anthropic"}` |
| Idempotency | Re-submitting same key bumps `version` (rotation, additive) |
| Reversal | `gad env revoke <key>` — immediate, with confirmation |
| Audit | `.gad/secrets/<projectid>.audit.jsonl` — append-only |

```sh
# Operator invocation (single command)
gad ask byok --projectid global

# Browser opens to http://127.0.0.1:<port>/
# Operator pastes ANTHROPIC_API_KEY value, submits
# Window closes, stdout shows the success JSON
```

```jsonl
# Training tuple shape (phase 153 SFT export schema)
{"system":"You are an agent operating inside the GAD framework.","prompt":"Operator needs to set their Anthropic API key.","tool_call":{"name":"capture_byok","args":{"provider":"anthropic","key_name":"ANTHROPIC_API_KEY"}},"tool_result":{"ok":true,"key":"ANTHROPIC_API_KEY","version":1,"provider":"anthropic"},"meta":{"label":"good","quality_reason":"key captured, encrypted, audit logged"}}
```

### 2.2 `gad ask todo` — capture a personal/operator todo

| | |
|---|---|
| Trigger | Operator wants to remember an action that's blocking them |
| Surface | Small browser form: title + body + owner + tags |
| Inputs | `title` (required), `body` (markdown, urls auto-linkify), `owner` (operator/agent/any, default operator), optional `snoozed_until` |
| Output | `.planning/todos/<YYYY-MM-DD>-<slug>.md` with frontmatter |
| Pop-up surface | Phase 165 OperatorTodosPopup auto-fires when there are unsnoozed `owner: operator` todos |

```sh
gad ask todo --projectid global
# captures funding-outreach style todos — body URLs become clickable
```

```jsonl
{"system":"...","prompt":"Operator wants to remember to file the company entity for AWS startup credits.","tool_call":{"name":"capture_todo","args":{"title":"File company entity for startup credits","body":"AWS / Azure / GCP all gate on legal entity. Need LLC formed before applying.","owner":"operator","tags":["funding","entity","blocking"]}},"tool_result":{"ok":true,"slug":"file-company-entity-for-startup-credits","date":"2026-05-08"},"meta":{"label":"good","quality_reason":"durable storage, surfaces in popup, operator-actionable"}}
```

### 2.3 `gad ask decision` — capture an approve/reject decision with rationale

| | |
|---|---|
| Trigger | Agent is at a decision point and wants operator approval |
| Surface | Small form: question + approve / reject buttons + note field |
| Inputs | `question`, `note` (optional rationale), `approval` (bool) |
| Output | New entry in `.planning/DECISIONS.xml` via `gad decisions add` |

```jsonl
{"system":"...","prompt":"Should we use Supabase pg_dump (BYOK) or Vercel native Postgres backup for phase 100-03?","tool_call":{"name":"capture_decision","args":{"question":"Use Supabase pg_dump or Vercel Postgres backup for customer SQL export?","approval":true,"note":"Supabase pg_dump — customer's data lives in their Supabase, BYOK keeps platform out of the data path."}},"tool_result":{"ok":true,"decision_id":"GLOBAL-D-303"},"meta":{"label":"good"}}
```

### 2.4 `gad ask text` — capture free-text answer to an agent's question

| | |
|---|---|
| Trigger | Agent has an open question that needs operator input |
| Surface | Small form: question + answer textarea |
| Inputs | `question`, `answer` (free text) |
| Output | Note appended to `.planning/notes/<date>-<slug>.md` (or returned for in-process agent consumption) |

## 3. MCP-callable components (Kael chat)

These are the same surfaces, but invoked from chat by the LLM via the
MCP tool registry (`gad mcp tools`). Each has an inline render in
`apps/desktop/src/lib/kael-toolkit/` and may also open as a transient
Tauri window if the manifest declares `surface: transient`.

### 3.1 `show_operator_todos` — phase 162-01

```jsonl
{"system":"...","prompt":"What do I need to do today?","tool_call":{"name":"show_operator_todos","args":{}},"tool_result":[{"slug":"funding-outreach-and-business-setup","title":"Funding outreach + business entity","owner":"operator","body":"1. NVIDIA Inception — https://www.nvidia.com/en-us/startups/ ..."}],"render":"inline-card-list","meta":{"label":"good","quality_reason":"surfaced operator-only todos, URLs clickable"}}
```

### 3.2 `team_status` — phase 162-02

```jsonl
{"system":"...","prompt":"How's the team?","tool_call":{"name":"team_status","args":{}},"tool_result":[{"id":"w1","runtime":"codex-cli","status":"working","tasks":2},{"id":"w6","runtime":"claude-code","status":"idle","tasks":0}],"render":"worker-grid","meta":{"label":"good"}}
```

### 3.3 `activity_stream` — phase 162-03

```jsonl
{"system":"...","prompt":"What's been happening in the last hour?","tool_call":{"name":"activity_stream","args":{"since_minutes":60,"limit":50}},"tool_result":[{"ts":"...","source":"worker","summary":"w1 claimed h-...-160-02"},...],"render":"scrolling-log","meta":{"label":"good"}}
```

### 3.4 `claim_handoff` — phase 162-04 (two-step needs-confirmation)

Stage 1 (preview):
```jsonl
{"system":"...","prompt":"Claim handoff h-2026-05-07T15-50-09-slm-learning-04","tool_call":{"name":"claim_handoff","args":{"handoff_id":"h-2026-05-07T15-50-09-slm-learning-04"}},"tool_result":{"id":"h-...","priority":"normal","body":"...","staged_for":"preview"},"render":"preview-card-with-confirm-button","meta":{"label":"good","note":"mutation-free preview; operator must press Confirm"}}
```

Stage 2 (after operator clicks Confirm — separate tool call):
```jsonl
{"prompt":"<operator-confirm-click>","tool_call":{"name":"claim_handoff_confirmed","args":{"handoff_id":"h-..."}},"tool_result":{"ok":true,"claimed_by":"claude-code"},"meta":{"label":"good"}}
```

### 3.5 `find_component` + `launch_component` — phase 162-05

```jsonl
{"system":"...","prompt":"Find me a way to see runtime health","tool_call":{"name":"find_component","args":{"intent":"runtime health"}},"tool_result":[{"id":"runtime-health","title":"Runtime health","intent":"...","route":"/admin/runtime-health","surface":"transient","score":5}],"render":"ranked-cards-with-launch-buttons","meta":{"label":"good"}}

{"prompt":"<launch-button-click>","tool_call":{"name":"launch_component","args":{"component_id":"runtime-health"}},"tool_result":{"ok":true,"surface":"transient","window_label":"transient-1730997123-runtime-health"},"render":"opened-confirmation-with-close-button","meta":{"label":"good"}}
```

## 4. The on-demand sweep (replaces always-on daemon for non-realtime work)

`sweep_handoffs` MCP tool — phase 164. Operator says "sweep the team"
or "run a tick" → tool runs the same body the overnight daemon would
have run, returns structured summary.

```jsonl
{"system":"...","prompt":"Sweep the team","tool_call":{"name":"sweep_handoffs","args":{"project":"global","dry_run":false}},"tool_result":{"ok":true,"health":{"healthy":true},"provenance":{"ok":true,"skipped":true,"reason":"no new traces"},"sweep":{"closed":0},"handoffs":{"created":0},"elapsed_s":2.5},"meta":{"label":"good"}}
```

## 5. Production-mode (always-on with hardening)

The daemon path is still available — phase 159 hardened it (30min
ticks, in-flight guard, BELOW_NORMAL Windows priority, skip-if-no-
traces, 2-strike worker-stall). Operator launches when they want
ambient curation:

```sh
gad overnight start --detach --tick-minutes 30
gad datasets curate --daemon --tick-minutes 30   # phase 170
```

Both follow the SAME hardening pattern. Both produce ambient training
data in `.planning/datasets/<label>/<date>.jsonl`.

## 6. Training-data emission — how the SFT corpus is built

```
.planning/transcripts/<date>/<thread>.jsonl   phase 169 (Kael chat)
.planning/.trace-events.jsonl                  phase 153 (CLI traces)
.planning/team/workers/<id>/log.jsonl          worker logs
.planning/datasets/<label>/<date>.jsonl        phase 170 (curated tuples)
.planning/datasets/slm-disagreement/<date>.jsonl   phase 171 (delta logs)

Curator → SFT export pipeline:
  gad datasets curate --once       runs the classifier → labeled tuples
  gad provenance sft-export        emits training-shaped jsonl per
                                   runtime per task-type per date
  gad datasets push-remote         uploads to Supabase Storage bucket
                                   gad-datasets (phase 132 + 170)
```

Every tray-app invocation that flows through the gad CLI is logged
to `.trace-events.jsonl` with full args + result + timing — that's
the source signal the curator picks up. Add owner/quality labels via
the disagreement logger or post-hoc annotation.

## 7. The map — which phase shipped what

| Surface | Phase | Status |
|---|---|---|
| `gad ask byok|todo|decision|text` | 158 | ✓ shipped (source); installed gad.exe stale, needs rebuild |
| `gad mcp serve` + tool registry | 157 / 161 | ✓ |
| `.planning/mcp-app.json` manifest | 161 | ✓ |
| Kael shell at /kael (apps/desktop) | 160 | ✓ |
| OperatorTodosPopup overlay on /kael | 165 | ✓ |
| 6 chat MCP tools with inline render | 162 | ✓ |
| Tauri transient-window protocol | 163 | ✓ |
| sweep_handoffs MCP tool | 164 | ✓ |
| `gad desktop launch` (no-cd launcher with BYOK injection) | new 2026-05-08 | ✓ |
| Standalone Tauri pages for /admin/* surfaces | — | ⏳ NOT SHIPPED — manifest declares routes, page bodies missing |

## 8. Closing the gap — what would make this a complete tray-app suite

1. **Rebuild + replace the installed gad binary** so `gad ask byok|todo|decision|text` and the rest of phase-158-onwards CLI is reachable everywhere. One-command fix:
   ```sh
   node vendor/get-anything-done/scripts/build-bun-release.mjs
   # then copy dist/release/gad-v1.35.0-windows-x64.exe to %LOCALAPPDATA%\Programs\gad\bin\gad.exe
   ```
2. **Ship the standalone Tauri pages** at `/admin/operator-todos`, `/admin/team-status`, `/admin/runtime-health`, `/admin/activity`, `/byok` — each renders ONE component (extract the body of the kael-toolkit/<tool>.tsx render). Each is < 100 LOC because the components already exist.
3. **MCP server as a system-tray-icon-style background** — phase 172+ scope: `gad mcp serve --tray` runs with a Tauri tray icon that lists transient surfaces in a context menu.

(2) and (3) are the real "tray app suite" the operator described. (1)
is a one-line operator action that unblocks phase 158's existing forms.

## 9. Self-test (operator can run today)

```sh
# Verify the substrate is reachable
gad mcp tools                     # 17+ MCP tools listed
gad ask --help                     # works in source build
gad desktop status                  # works (just shipped)
gad notify list --json             # phase 111 substrate
gad collisions list --json          # phase 122 substrate
gad discipline rules --json         # phase 123 substrate
gad pressure snapshot --json       # phase 107 combined dimensions
gad datasets timeline --since 2026-05-01 --json   # phase 170
```

If any of these fail with "Unknown command", the installed binary is
stale — fix per §8 step 1.
