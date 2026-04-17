---
id: security-fail-closed-01
title: Fail closed — never silently fall back when the safety check fails
category: security
difficulty: beginner
tags: [defense-in-depth, error-handling, gitignore, posture]
source: static
date: 2026-04-17
implementation: vendor/get-anything-done/references/byok-design.md
decisions: gad-266, gad-267
phases: get-anything-done:60
related: security-aead-aad-01, security-derive-dont-store-01
---

# Fail closed — never silently fall back when the safety check fails

There are two ways code can react when a safety check fails:

| posture | what it does when something is wrong |
|---|---|
| **fail open** | shrug, keep going with a less-safe path |
| **fail closed** | stop. Refuse to proceed. Surface a loud error. |

For anything that protects secrets or state, **fail closed is the default**. "Fail open" is the word for "the security property was optional."

## The BYOK gitignore example

BYOK stores encrypted keys at `.gad/secrets/<projectid>.enc`. On first `gad env set`, the CLI adds `.gad/` to the project's `.gitignore` so operators don't accidentally commit the encrypted bag.

What if writing to `.gitignore` fails? (Permissions, read-only filesystem, file locked by another editor.)

**Fail-open answer:** log a warning, write the encrypted bag anyway, let the operator discover later that the bag is in git history.

**Fail-closed answer:** don't write the bag. Return an error: `GITIGNORE_WRITE_FAILED — refused to write .gad/secrets/ because .gitignore could not be updated. Fix the .gitignore, then retry.`

Fail closed feels annoying to the user in the moment. But "fail open" here means a real risk: encrypted keys committed to git, pushed to a remote, visible in history forever. No amount of "remove and force push" truly cleans that up.

## The pattern generalizes

| situation | fail-closed behavior |
|---|---|
| rate limit check errors | deny, don't allow |
| auth token parse fails | reject, don't skip |
| schema migration partially applied | refuse to start the app |
| CSRF token mismatch | reject the request |
| config load fails | exit with error, don't run on defaults |
| key derivation params inconsistent | refuse to decrypt |

## When fail-open IS OK

**Non-security concerns with safe defaults.** Examples:
- Metrics collector failing — drop the metric, keep serving requests. (Metrics aren't safety-critical.)
- A/B flag service timeout — use the default bucket, keep serving. (Flags have intended default behavior.)

The split is simple: if failure of the check could lead to data leaking, state corruption, or privilege escalation, fail closed. If failure only affects observability or cosmetic behavior, fail open is fine.

## Takeaway

When you find yourself writing `try { safetyCheck() } catch { /* fall through */ }`, stop and ask: would the attacker prefer this to throw, or prefer this to be silently skipped? If they'd prefer the skip, you're writing fail-open code. Reverse it.

Bonus tip for logs: "failed to write gitignore, continuing anyway" is one of the most common lines in breach post-mortems. It's a fail-open antipattern with a warning on top, which makes it look rigorous while being exactly as dangerous as having no log at all.
