---
id: gad-framework-error-cause-preservation-01
title: Error rewrap with .cause — preserve the stack across module boundaries
category: gad-framework
difficulty: intermediate
tags: [error-handling, debugging, stack-traces, typescript, javascript]
source: static
date: 2026-04-17
implementation: vendor/get-anything-done/lib/scoped-spawn.cjs
decisions: gad-266, gad-267
phases: get-anything-done:60
related: security-error-code-remediation-01, gad-framework-testable-cli-01
---

# Error rewrap with `.cause` — preserve the stack across module boundaries

Your module calls into another module's API. That API can throw. You want to:

- **Translate** the error into your module's vocabulary (e.g. downstream `KEY_NOT_FOUND` becomes your-layer `PROJECT_NOT_FOUND`).
- **Preserve** the underlying cause for debugging — stack, message, original `code`.
- **Not lose context** when the error travels further up the stack.

The wrong way is to swallow the original and throw a fresh one:

```js
try {
  await store.get({ projectId, keyName });
} catch (err) {
  throw new ScopedSpawnError('DECRYPT_FAILED', `decrypt failed for ${projectId}`);
  //    ^^^ original stack + original code + original message: GONE
}
```

Two weeks later an operator hits DECRYPT_FAILED in prod. The stack points at your module. The error says "decrypt failed." Useful? No — you can't tell if it was a wrong passphrase, a locked keychain, a corrupted bag, or a network fault. You've thrown away the diagnostic.

## The fix — `Error.cause`

ES2022 added a standard `cause` option on Error. Use it:

```js
try {
  await store.get({ projectId, keyName });
} catch (err) {
  throw new ScopedSpawnError(
    'DECRYPT_FAILED',
    `decrypt failed for ${projectId}/${keyName}`,
    { cause: err },
  );
}
```

Downstream code that formats the error can walk `.cause`:

```js
function formatError(err) {
  let out = `${err.code ?? 'ERROR'}: ${err.message}`;
  let c = err.cause;
  while (c) {
    out += `\n  ↳ caused by: ${c.code ?? c.constructor.name}: ${c.message}`;
    c = c.cause;
  }
  return out;
}
```

Output on a real bad-passphrase failure:

```
DECRYPT_FAILED: decrypt failed for llm-from-scratch/OPENAI_API_KEY
  ↳ caused by: PASSPHRASE_INVALID: passphrase did not decrypt the verifier slot
  ↳ caused by: Error: auth tag verify failed
```

Each layer added its vocabulary without obliterating the one below it. A debugger can see the whole chain.

## Why not just let the original error propagate?

You could. But then every caller has to know the full vocabulary of every library you wrap. Rewrapping lets each module expose a clean, stable error surface while still preserving the diagnostic path. The contract at the outer boundary stays minimal; the information for debugging is still complete.

## Make your custom error carry it cleanly

Extend Error with a `cause`-aware constructor:

```js
class ScopedSpawnError extends Error {
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'ScopedSpawnError';
    this.code = code;
    // copy any helpful fields the caller passed
    for (const k of ['projectId', 'command']) {
      if (options[k]) this[k] = options[k];
    }
  }
}
```

Node 22+, modern browsers, and TypeScript 4.6+ all support `Error.cause` natively. If you're on older Node, polyfill by assigning `.cause` manually after construction.

## JSON-serialize it for logs

`JSON.stringify(err)` drops non-enumerable properties including `cause` and `message`. Ship a `toJSON` method on your class:

```js
toJSON() {
  return {
    name: this.name,
    code: this.code,
    message: this.message,
    projectId: this.projectId,
    command: this.command,
    cause: this.cause ? {
      name: this.cause.name,
      code: this.cause.code,
      message: this.cause.message,
    } : undefined,
  };
}
```

Now log lines carry the chain instead of `{}`.

## The test discipline

When you rewrap, write a test that asserts both:

1. The outer error has the expected `code`.
2. `err.cause.code` equals the original downstream code.

That guarantees future refactors don't accidentally flatten the chain. One line per boundary. Saves days of production debugging.

## Takeaway

Translate errors at module boundaries — that's how you keep a clean public API. But translate WITH `cause`. Losing the original stack is a form of information destruction that bites you during incidents. `.cause` is free, standard, and makes every log line a nested diagnostic. Do it every time.
