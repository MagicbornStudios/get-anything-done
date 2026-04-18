---
id: gad-framework-defensive-aggregation-01
title: Defensive aggregation — don't let one bad source 500 the whole view
category: gad-framework
difficulty: intermediate
tags: [error-handling, filesystem, dashboards, server-components, robustness]
source: static
date: 2026-04-17
implementation: apps/planning-app/lib/projects-data.ts, apps/planning-app/app/my-projects/SubagentRunHistory.tsx
decisions: gad-267
phases: get-anything-done:59
related: gad-framework-error-cause-preservation-01, security-fail-closed-01
---

# Defensive aggregation — don't let one bad source 500 the whole view

You're building a dashboard that aggregates data from N sources — project roots, user accounts, queue workers, log files, whatever. Each source is independent. In the happy path, all N succeed. In reality, source #7 has a corrupted file, a missing dir, a permission error, or a concurrent writer halfway through writing.

If your aggregator just `Promise.all()`s a bunch of reads, one bad source takes down the whole page. 500, nothing renders, user can't access the other 9 sources either. That's a fail-open disaster disguised as correctness (see `security-fail-closed-01` for the broader posture).

Two techniques, both in use on the `/my-projects` dashboard.

## Technique 1 — degraded entry over throw (the multi-source aggregator pattern)

Wrap EACH source read in its own try/catch. On success, return the full data. On failure, return a flagged "degraded" entry that the renderer knows how to show.

```ts
// projects-data.ts
type ProjectCardData =
  | { id: string; ok: true; currentPhase: string; nextAction: string; /*...*/ }
  | { id: string; ok: false; degraded: true; error: string };

function loadProjectCard(id: string, rootPath: string): ProjectCardData {
  try {
    const state = readState(rootPath);
    const tasks = readTaskRegistry(rootPath);
    return { id, ok: true, currentPhase: state.currentPhase, /*...*/ };
  } catch (err) {
    return {
      id,
      ok: false,
      degraded: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function loadAllProjects(): { cards: ProjectCardData[]; repoRoot: string } {
  const roots = parseConfig();
  return { cards: roots.map((r) => loadProjectCard(r.id, r.path)), repoRoot };
}
```

Render side:

```tsx
{card.ok ? <ProjectCard card={card} /> : <DegradedCard card={card} />}
```

One bad root renders as a red-bordered "couldn't load this project — here's why" card. The nine good ones render fine. The user sees the problem scoped to the source, and can investigate it without losing access to everything else.

The general rule: **the blast radius of a single-source failure should be that single source's tile, not the page.**

## Technique 2 — safe-parse per file with skip-on-failure (the concurrent-writer pattern)

Some aggregators scan a directory of files written by another process. A daemon is appending run records. A CLI is dropping log files. There will ALWAYS be a moment where one file is half-written — the writer is mid-flush, the JSON is truncated, your reader catches it at exactly the wrong microsecond.

If your reader parses the directory as a single operation (`files.map(JSON.parse)`), one half-written file throws and the whole batch fails. The user sees an empty dashboard when there are 50 perfectly good records and 1 in-flight write.

Fix: parse each file independently. Skip the ones that fail. Keep the ones that succeed.

```ts
function readRunHistory(dir: string): Run[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const runs: Run[] = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      const parsed = JSON.parse(raw);
      runs.push(parsed);
    } catch {
      // In-progress write, truncated file, or format drift.
      // Silently skip — the writer will produce a readable version
      // on its next flush.
      continue;
    }
  }
  return runs.sort((a, b) => b.ts - a.ts);
}
```

The silent skip is intentional. A half-written JSON file is an **expected transient state**, not a bug. Loudly warning would spam the UI. The next render will pick it up.

## When silent skip is wrong

Don't silently skip things that SHOULDN'T fail. If the writer guarantees atomic rename (write to tmp, rename into place), then a mid-write half-file literally cannot exist — and any parse failure is a real bug worth throwing on. Silent skip is only appropriate when the storage contract permits transient half-states.

Rule: `skip` is correct when the failure mode is **known-transient and unavoidable by design**. `throw` is correct when the failure mode is **supposed to be impossible**.

## Both techniques share the same invariant

**Each independent source gets its own try/catch. Never a shared one.** When you find yourself writing `try { await Promise.all(sources.map(read)) } catch`, stop — you've just made one bad source crash the whole view. Pull the try inside the map.

## Takeaway

Aggregation views must not go down because of one source. Wrap each source read in its own try/catch; render degraded entries for sources that failed, keep rendering the ones that succeeded. For concurrent-writer directory scans, silently skip parse failures — they represent expected transient state, not bugs. A dashboard that stays partially useful when some of its sources break is vastly more useful than one that shows 500 when any of them do.
