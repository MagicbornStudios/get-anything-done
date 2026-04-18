---
id: gad-framework-testable-cli-01
title: Testable CLI via injected stdio — stop monkey-patching process
category: gad-framework
difficulty: intermediate
tags: [testing, cli, dependency-injection, factory-pattern]
source: static
date: 2026-04-17
implementation: vendor/get-anything-done/lib/env-cli.cjs
decisions: gad-267
phases: get-anything-done:60
related: security-error-code-remediation-01
---

# Testable CLI via injected stdio — stop monkey-patching process

You're writing a CLI command. It needs to read a password from a TTY, print results to stdout, show errors on stderr, maybe confirm destructive actions. How do you test it?

The naive answer: hit `process.stdin`, `process.stdout`, `process.stderr`, `process.exit()` directly. Then in tests, monkey-patch those globals. Run the test. Restore the globals in an `afterEach`. Repeat.

It works. It's also a maintenance headache:

- Tests leak state across runs when cleanup forgets.
- Parallel tests can't run — two tests simultaneously patch `process.stdout` and clobber each other.
- `process.exit()` is hard to test without actually terminating the process (try/catch around `throw ExitError` is a common workaround but still brittle).
- Mocking raw-mode stdin interactions is genuinely painful.

## The factory pattern

Wrap the command in a factory that takes its dependencies as arguments:

```js
// env-cli.cjs
function createEnvCli({
  store,              // the underlying library (mock in tests)
  readPassphrase,     // async () => Buffer  (mock in tests)
  stdin,              // readable stream    (mock in tests)
  stdout,             // writable stream    (mock in tests)
  stderr,             // writable stream    (mock in tests)
  exit,               // (code) => void     (mock in tests)
  confirm,            // async (msg) => bool (mock in tests)
}) {
  return {
    async get({ projectId, keyName }) { /* uses stdout/stderr/exit */ },
    async set({ projectId, keyName, fromStdin }) { /* uses readPassphrase */ },
    // etc.
  };
}

module.exports = { createEnvCli };
```

The `bin/` file (the actual entry point) wires the real process streams:

```js
// bin/gad.cjs
const envCli = createEnvCli({
  store: require('./secrets-store.cjs'),
  readPassphrase,
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  exit: process.exit,
  confirm: async (msg) => /* TTY prompt */,
});
```

## What tests look like

No globals touched. Everything is explicit. Parallel-safe:

```js
test('env get KEY_NOT_FOUND exits 1 with remediation hint', async () => {
  const stdout = new WritableBuffer();
  const stderr = new WritableBuffer();
  let exitCode = null;
  const cli = createEnvCli({
    store: fakeStoreThatThrows({ code: 'KEY_NOT_FOUND', keyName: 'X', projectId: 'P' }),
    stdout, stderr,
    exit: (c) => { exitCode = c; },
    // ... other deps
  });
  await cli.get({ projectId: 'P', keyName: 'X' });
  assert.equal(exitCode, 1);
  assert.match(stderr.toString(), /gad env set X --projectid P/);
  assert.equal(stdout.toString(), '');  // must stay clean
});
```

## Three things this buys you

1. **Parallel tests.** No shared mutable state. Run the whole suite with `node --test --concurrency 8`.
2. **Stdout purity assertion.** You can assert that `stdout` is EXACTLY the decrypted value (so `$(gad env get ...)` composes correctly). Can't do that reliably when tests also write to stdout for their own output.
3. **Exit-code testing without process termination.** The `exit` fn is a pure callback. No `throw`, no child process, no skipping rest of test.

## The key invariant

**Only `bin/` touches `process.*`. Library code and command implementations get their stdio/exit via dependency injection.**

That's the seam. Keep the seam clean and testability follows.

## Where else this pattern fits

- Anywhere you'd otherwise stub `process.env` (inject an `env` object).
- Anywhere you'd stub `Date.now()` (inject a `now` function).
- Anywhere you'd stub `fs` calls (inject a mini `fs` interface — overkill for most cases but useful for heavy FS code).

The general rule: if a test needs to inspect or control a side effect, that side effect's source belongs in the constructor signature, not in a global.

## Takeaway

Factories + injected stdio turn CLI testing from "try/finally around globals" into "pass in mocks, assert on captured buffers." The wiring is ~15 lines in `bin/`. The payoff is every command handler is pure enough to test in isolation. Do this on day one, not as a retrofit.
