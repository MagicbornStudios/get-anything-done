---
id: gad-framework-filename-prefix-idempotency-01
title: Filename-prefix as idempotency key — skip-already-done without parsing
category: gad-framework
difficulty: beginner
tags: [idempotency, filesystem, daily-loops, concurrency, robustness]
source: static
date: 2026-04-17
implementation: vendor/get-anything-done/lib/subagent-dispatch.cjs
decisions: gad-258, gad-267
phases: get-anything-done:59
related: gad-framework-defensive-aggregation-01, security-fail-closed-01
---

# Filename-prefix as idempotency key — skip-already-done without parsing

You run a daily loop. A cron, a startup hook, a `gad start --dispatch-subagents`. It finds eligible work and runs it. If the user runs the loop twice the same day, you want the second invocation to skip — no duplicate work, no clobbered record.

The common way is to parse a state file and check a timestamp. That works but has a subtle problem: what if the state file is half-written? Corrupt? A future schema?

A simpler way: use the **filename itself** as the idempotency key.

## The pattern

Each run drops a record at a predictable path whose name includes today's date:

```
.planning/subagent-runs/<projectid>/<YYYY-MM-DD>-<taskid>.json
.planning/subagent-runs/<projectid>/<YYYY-MM-DD>-<taskid>.prompt.md
```

Before running, check the directory for any file matching `${today}-*`. If found → skip. No JSON parse. No schema read. Just a directory listing.

```js
function alreadyRanToday(projectRunsDir, today) {
  try {
    const files = fs.readdirSync(projectRunsDir);
    return files.some((f) => f.startsWith(today));
  } catch (err) {
    if (err.code === 'ENOENT') return false; // dir doesn't exist → never ran
    throw err;
  }
}
```

## Three properties this gets you

**1. Corruption-safe.** A half-written JSON record still has its filename. The prefix check still sees it. Second invocation correctly skips rather than re-dispatching on top of an in-flight record.

**2. Schema-independent.** The state file's shape can evolve freely (add fields, rename, version up) — the idempotency check doesn't read any of the contents.

**3. Observable.** `ls .planning/subagent-runs/<pid>/` gives you a one-glance daily-log history. Dates across rows tell the whole story. You can grep, sort, pipe to `wc -l` for a count.

## The ingredients

The pattern needs:

- **A monotonic prefix.** Date at day-granularity is the common choice. For finer loops, use `YYYY-MM-DD-HHMM` or similar. Whatever granularity matches the intended dedup window.
- **An atomic write.** Write to a `.tmp` file, then `rename` into place. The rename is atomic on POSIX (and on Windows if source + dest are on the same volume). A half-written tmp file with the wrong name doesn't trigger the skip. The final-named file appears fully formed or not at all.
- **A deterministic filename.** `${today}-${taskId}.json` not `${uuid}.json`. The date prefix is what you grep for; the task id is what gives you uniqueness across different tasks on the same day.

## The anti-pattern — state in one JSON file

```
.planning/subagent-runs.json    # { lastRunDate: "2026-04-17", ... }
```

Reads are cheap but:

- Half-written → skip-check either crashes or returns nonsense
- Schema change → migration on every read
- Multiple writers → race on the single file
- No history — just the latest entry

Directory-of-files scales. Single-file state does not.

## When you also need the record

After the skip check passes and you decide to run, IMMEDIATELY write a stub file with the final name:

```js
fs.writeFileSync(
  `${projectRunsDir}/${today}-${taskId}.json.tmp`,
  JSON.stringify({ status: 'pending-dispatch', startedAt: new Date().toISOString() }),
);
fs.renameSync(
  `${projectRunsDir}/${today}-${taskId}.json.tmp`,
  `${projectRunsDir}/${today}-${taskId}.json`,
);
```

Now a concurrent second invocation immediately sees the filename and bails. The real dispatch proceeds. When it completes, update the JSON in place (tmp + rename again). Cooperative exclusion without locks.

## Local date, not UTC — when the work is human-scheduled

One footgun: use **local date** (with offset) for the prefix, not UTC. A daily loop timed to a user's evening fires TWICE on days where UTC and local dates disagree (a late-night user does their run, `new Date().toISOString()` reports the UTC next-day prefix, the next morning's run gets the local-today prefix — two records, two dispatches). Pick local. Document the choice.

```js
function toLocalIsoDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
```

## Takeaway

Directory of date-prefixed files is the simplest durable primitive for daily-loop idempotency. Corruption-safe, schema-independent, observable, scales. Reach for it before you reach for a single state file or a lock. Use local-date when humans schedule the work.
