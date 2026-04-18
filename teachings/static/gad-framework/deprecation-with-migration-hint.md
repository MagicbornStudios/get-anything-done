---
id: gad-framework-deprecation-migration-hint-01
title: Deprecation warnings should name the migration command — not just "use the new way"
category: gad-framework
difficulty: beginner
tags: [deprecation, migration, ux, cli, operator-experience]
source: static
date: 2026-04-17
implementation: vendor/get-anything-done/lib/openai-client.cjs
decisions: gad-263, gad-266, gad-267
phases: get-anything-done:60
related: security-error-code-remediation-01, gad-framework-filename-prefix-idempotency-01
---

# Deprecation warnings should name the migration command — not just "use the new way"

You're migrating a value-resolution path from one source to another. BYOK keys move from `process.env.OPENAI_API_KEY` into a per-project encrypted bag. Config files move from `.rc` to `.toml`. Credentials move from env vars to a keychain. Whatever the case, you want the old path to keep working through a cutover window with a warning steering operators toward the new one.

The common-but-wrong form of the warning:

```
OPENAI_API_KEY resolved from process.env. This is deprecated —
please migrate to the new secrets bag.
```

Technically honest. Operationally useless. "Please migrate" is not a command. The operator now has to read docs, find which CLI does the migration, figure out the flags. Half of them will ignore the warning because the code still works. The deprecation window closes and their scripts break with no runway.

## The right form: name the command

```
OPENAI_API_KEY resolved from process.env for project 'llm-from-scratch'.
Migrate with: gad env set OPENAI_API_KEY --projectid llm-from-scratch
```

Three improvements:

1. **Copy-pasteable.** Select + paste + enter. No docs round-trip.
2. **Parameterized.** The `projectId` is dropped into the command for you. Operators with 10 projects don't have to think about which one.
3. **Impossible to ignore passively.** Even if you don't act on it today, next time you look at the warning the command is right there.

## Four rules for useful deprecation warnings

**1. Name the exact next command the operator must run.**

Not "migrate to `gad env`" — name the full command line with the flags filled in:

```
gad env set OPENAI_API_KEY --projectid llm-from-scratch
```

**2. Parameterize from the runtime context, not from the docs.**

The operator's `projectId` should come from your code's knowledge, not from their having to remember it. If the warning fires inside a call that knows the project, stamp the project name into the warning.

**3. Say what will change when the window closes.**

```
After 2026-06-01, resolution from process.env stops. Run the above
to migrate before then.
```

Gives operators a calendar, not just an abstract "eventually." Optional but a big help when the cutover is slow-rolling.

**4. Log at warn level, not info. Exactly once per process lifetime.**

Every call that uses the deprecated path SHOULD log, but at most once per process. Flood protection is built into most loggers; if yours doesn't do it automatically, wrap the warn call in a per-key `Set` guard. Operators ignore hundreds of identical log lines. They read one.

## When silence is wrong even with migration hint

If the deprecated code path has a **security implication** — like env-fallback resolving a key that should've come from a keychain unlock — consider making the warning a stderr print, not just a debug log. The higher the cost of ignoring, the noisier the notice. Matching-severity communication matters.

## The anti-anti-pattern — don't get too clever

Do NOT auto-migrate on the deprecated path. That's tempting ("we resolved from env, let's quietly `gad env set` for them") and always wrong:

- You might write the wrong value (env was stale, but the bag was cleared intentionally).
- You hide the operator's agency in choosing when to migrate.
- The "this still works" signal tells the operator nothing is urgent.

Warn, don't migrate. The operator is in charge.

## The generalized rule

Every deprecation warning should contain a COMMAND the operator could run RIGHT NOW to fix the warning. Not a link to docs, not a description of the new way — the literal bytes they should type. If you can't write that line, your migration is under-designed and the deprecation is premature.

## Takeaway

Deprecation warnings are a UX surface. They compete with every other warning in the operator's console for attention. The ones that win give the operator a one-line action. Add the command to the warning, parameterize from your own runtime context, and operators migrate willingly. Skip the command and you've written deprecation noise.
