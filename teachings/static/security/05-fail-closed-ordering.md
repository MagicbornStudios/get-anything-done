---
id: security-fail-closed-ordering-01
title: Fail-closed ordering — run the guard before any on-disk change
category: security
difficulty: beginner
tags: [defense-in-depth, error-handling, atomicity, ordering]
source: static
date: 2026-04-17
implementation: vendor/get-anything-done/lib/secrets-store.cjs
decisions: gad-266, gad-267
phases: get-anything-done:60
related: security-fail-closed-01, security-aead-aad-01
---

# Fail-closed ordering — run the guard before any on-disk change

You've decided to fail closed when a safety invariant can't be met (see `security-fail-closed-01`). Half the battle. The other half is **ordering** — WHERE in the sequence of mutations you run the check.

The wrong way is to lay down the sensitive file first and THEN try to satisfy the guard. If the guard fails, you've already written the thing you were trying to protect.

## The BYOK gitignore example (again, but sharper)

On first `gad env set`, two things have to happen:

1. Ensure `.gad/` is in the project's `.gitignore`
2. Write `.gad/secrets/<projectid>.enc` to disk

Tempting natural order: write the encrypted file, then write the gitignore. Feels logical — the "main" work first, the "metadata" second.

But what if step 2 fails? File is locked. Permissions. Read-only filesystem. Disk full. Now `.gad/secrets/<projectid>.enc` exists on disk with no `.gitignore` entry. The user's next `git add -A` stages it. Their next push leaks it.

**The fail-closed safety property existed but ran too late to protect anything.**

## The correct order

Run the invariant check FIRST:

```
1. Compute what the gitignore should look like
2. Attempt to write the gitignore
   → fails? throw GITIGNORE_WRITE_FAILED. Nothing else happens.
3. Read it back. Verify the entry is present.
   → entry missing? throw GITIGNORE_WRITE_FAILED.
4. ONLY NOW write .gad/secrets/<projectid>.enc.
```

If anything goes wrong in steps 1-3, no secrets file exists. The repo state is identical to before the call. The operator gets a clear error with zero leak risk.

## The rule

**If a safety check gates a mutation, the check must run and succeed before ANY byte of the mutation lands on disk.**

Corollary: if you need multiple mutations to happen atomically, use a temp file + rename pattern — write to a temp location, run the guard, then rename into place. POSIX rename is atomic on the same filesystem; Windows has caveats (ReplaceFile / MoveFileEx with MOVEFILE_REPLACE_EXISTING) but the principle holds.

## Where this goes wrong

Common footguns:

| situation | naive order | correct order |
|---|---|---|
| Secret write + gitignore | write secret, update gitignore | update gitignore, verify, write secret |
| DB write + audit log | insert row, write audit event | stage transaction, append audit event, commit |
| Upload + ACL | upload blob, set ACL | set ACL on placeholder, upload blob, finalize |
| Cache + invalidation | update cache, invalidate peers | acquire invalidation lock, update cache, release |
| Config write + reload | write config, trigger reload | validate config, write, trigger reload |

In every pair the naive order creates a window where the protected resource exists in an unprotected state. The correct order eliminates the window.

## Don't rely on error handlers to "undo" it

Cleanup-on-failure code is fragile. It might not run (`kill -9`, OOM, power loss). It might leave half-cleaned state. Preventing the mutation from happening in the first place is infinitely more reliable than trying to roll back after the fact.

## Takeaway

"Fail closed" tells you WHAT to do when a safety check fails. "Fail-closed ordering" tells you WHEN to run the check: before any mutation the check is meant to protect. Get both right or the safety property is decorative.
