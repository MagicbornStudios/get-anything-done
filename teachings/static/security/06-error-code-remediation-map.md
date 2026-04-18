---
id: security-error-code-remediation-01
title: Error code → remediation map — turn named errors into actionable CLI output
category: security
difficulty: beginner
tags: [error-handling, cli, ux, defense-in-depth]
source: static
date: 2026-04-17
implementation: vendor/get-anything-done/lib/env-cli.cjs
decisions: gad-266, gad-267
phases: get-anything-done:60
related: security-fail-closed-01, security-passphrase-verifier-01
---

# Error code → remediation map — turn named errors into actionable CLI output

Your library throws errors with discriminating codes — `PASSPHRASE_INVALID`, `KEYCHAIN_LOCKED`, `KEY_NOT_FOUND`, `BAG_CORRUPT`. Good. That lets callers branch on cause.

The CLI wraps that library. A user runs `gad env get OPENAI_API_KEY --projectid llm-from-scratch` and gets:

```
Error: KEY_NOT_FOUND
```

Technically accurate. Completely useless. The user doesn't know this is a library-level enum value. They don't know whether the key exists under a different name, whether the project id is wrong, or whether they need to set it first.

## The pattern

Export a pure function on the CLI side that maps each code to an **actionable** human message:

```js
// env-cli.cjs
function messageFor(err) {
  switch (err.code) {
    case 'PASSPHRASE_INVALID':
      return 'Passphrase incorrect. Try again, or use --passphrase if keychain is out of sync.';
    case 'KEYCHAIN_UNAVAILABLE':
      return 'OS keychain not available on this platform. Re-run with --passphrase.';
    case 'KEY_NOT_FOUND':
      return `Key '${err.keyName}' not set for project '${err.projectId}'. Set it with: gad env set ${err.keyName} --projectid ${err.projectId}`;
    case 'BAG_CORRUPT':
      return `Encrypted bag at .gad/secrets/${err.projectId}.enc failed integrity check. Restore from backup and investigate.`;
    // ...
    default:
      return err.message || 'Unexpected error';
  }
}
module.exports = { messageFor };
```

The library stays terse (codes + metadata). The CLI injects the **operator context** — what to run next, where the file lives, which flag to flip.

## Three rules for the messages

1. **Name the next command.** Not "set the key first" but `gad env set OPENAI_API_KEY --projectid llm-from-scratch`. The user should be able to copy-paste the line and proceed.
2. **Name the file.** Not "the bag is corrupt" but `.gad/secrets/llm-from-scratch.enc failed integrity check`. The user needs to know where to look.
3. **Name the flag.** Not "try again with a different mode" but `re-run with --passphrase`. Exact flag, spelled right.

## Why pure + exported

Exporting `messageFor` as a named function (not a bare `switch` inside the error path) gives you:

- **Unit testable.** One test per code, assert output contains the expected command / path / flag. Near-free insurance against rot.
- **Reusable across surfaces.** Same mapper feeds the CLI, a future TUI, a log viewer, a web dashboard. Stay DRY.
- **Documentation-grep-able.** When someone asks "what does KEY_NOT_FOUND look like?", grep for the code and read the message. No running the program.

## Anti-pattern: message in the library

The library shouldn't know about `gad env set`. That's a CLI concern. If the same library ever powers a web UI or an API, the operator-CLI hint is wrong there. Keep codes in the library, messages in the surface.

## Takeaway

Library errors carry codes. CLI surfaces translate codes to actions. A named-exported `messageFor(err)` function is the seam between them — testable, reusable, and lets each error be a fingerpost instead of a wall.
