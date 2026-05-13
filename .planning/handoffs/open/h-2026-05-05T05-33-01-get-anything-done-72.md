---
id: h-2026-05-05T05-33-01-get-anything-done-72
projectid: get-anything-done
phase: 72
task_id: null
created_at: 2026-05-05T05:33:01.947Z
created_by: unknown
claimed_by: null
claimed_at: null
completed_at: null
priority: high
estimated_context: bounded
risk: safe
time: standard
surface: local
runtime_preference: codex-cli
---
OPERATOR ASK 2026-05-05: opencode must be installable via gad CLI like other runtimes. Current gap (validated tonight): slm-learning project tried to install + use opencode, couldn't. Should work parallel to 'gad install --claude/--codex/--gemini'. Tasks: (1) audit current install flag set in gad install --opencode (verify it's wired to actual opencode installer/binary acquisition, not just config-file write), (2) add opencode-bootstrap step that runs the equivalent of npm i -g opencode-ai (or whatever the current install path is) on first invocation, (3) ensure 'gad team start --runtime opencode' from a project that has never seen opencode before succeeds end-to-end (binary present + auth configured + first-tick succeeds), (4) document the opencode install path in references/ alongside codex/gemini. Operator standing rule: 'open code should be installable via our gad cli and installer package.' Stamp skill=cli or skill=install. Closeout: gad install --opencode in a fresh project produces working opencode runtime; gad team start --runtime opencode succeeds.