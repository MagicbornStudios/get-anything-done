---
id: dd-003
title: "Daemon flashing incident — auto-detect creds in curator"
problem: "Curator daemon was spawning and immediately dying (flashing) because it tried to push to Supabase/HF without checking credential availability first, causing an unhandled promise rejection that killed the process."
reasoning: "The auto-push path assumed creds were present if the flag was set. In practice the daemon starts at system boot before credentials are injected via BYOK. The fix required making credential detection a precondition, not a precondition-of-failure."
fix: "Added hasCredentials() checks to remote-supabase.cjs and remote-hf.cjs. curator.cjs resolveAutoPushTarget() returns null when neither detects creds; daemon logs a one-time skip rather than attempting the push."
principle: "Daemons must survive credential absence. Check availability before attempting push; never let a missing-creds error propagate to the event loop top level."
refs: ["GLOBAL-D-322","vendor/get-anything-done/lib/datasets/curator.cjs","vendor/get-anything-done/lib/datasets/remote-supabase.cjs","vendor/get-anything-done/lib/datasets/remote-hf.cjs","f79bf116"]
status: live
created_at: 2026-05-08T00:00:00Z
---

# Daemon flashing incident — auto-detect creds in curator

## Incident

Commit `f79bf116` fixed a curator daemon that was starting and immediately exiting (flashing).
The root cause: `--auto-push auto` resolved to `supabase` (first match), then `pushToSupabase`
threw because `SUPABASE_URL` / `SUPABASE_KEY` were not set. The unhandled rejection terminated
the Node process. The daemon appeared to "start" in the PID file then vanished.

## Why It Was Hard to Diagnose

- PID file was written before the tick ran (correct), so `gad datasets status` showed "running".
- The log file only showed "starting" with no error entry because the unhandled rejection
  bypassed the `try/catch` in `runTick`.
- Windows Task Manager showed the process spawn + immediate exit cycle at ~200ms intervals
  (the detach re-spawn loop attempted recovery).

## Root Cause

`resolveAutoPushTarget()` selected a target optimistically without verifying the target's
credential prerequisites. The credential check only happened inside the remote module's
push function — too late.

## Fix

Each remote module now exports `hasCredentials() → boolean`. `resolveAutoPushTarget()` calls
this before committing to a target. If no creds exist, returns `null`; tick proceeds without push.
A one-time log entry ("no creds — push skipped") prevents log spam on subsequent ticks.

## Principle

Fail-safe over fail-fast for daemons. Check preconditions before committing to a side-effect.
Unhandled rejections in daemon code = silent death.

## Related

- Commit `f79bf116`
- Decision GLOBAL-D-322 (design-decisions corpus)
- `vendor/get-anything-done/lib/datasets/curator.cjs`
- `vendor/get-anything-done/lib/datasets/remote-supabase.cjs`
- `vendor/get-anything-done/lib/datasets/remote-hf.cjs`
