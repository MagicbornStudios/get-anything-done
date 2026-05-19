# Gemini CLI auth — non-interactive / browser-URL flow

Phase 110 supplement task `GLOBAL-T-110-supplement-gemini`.
Investigation date: 2026-05-19.

## Problem

`gemini auth login` on Windows drops directly into an in-terminal
interactive prompt instead of printing a URL the operator can open in
a browser. Without a printable URL the operator cannot complete the
device flow when the prompt is invoked from inside a non-tty context
(spawned by gad team workers, a tauri sidecar, a CI job, etc.).

This blocks `gad accounts add gemini --label <name>` recapture for the
paid-google-ai-pro account and prevents the gemini fallback chain from
having credentials when the existing oauth file expires.

## Working sequence (documented for now)

### 1. Pre-2.x gemini-cli (the version installed on this machine)

The historical CLI exposes a `--no-browser` flag on the auth subcommand
that switches it into device-code mode. Status as of 2026-05-19: the
flag is present in the help output but does not consistently print the
verification URL on Windows — depending on shell environment it still
opens the system browser silently and waits for the redirect callback
on `localhost:8085`.

Reliable fallback we've validated:

```sh
# 1. Run from a regular interactive shell (Windows Terminal, not from
#    a spawned subprocess). Force the device flow so the URL prints to
#    stdout instead of a browser auto-launch.
GEMINI_NO_BROWSER=1 gemini auth login

# 2. Copy the printed verification URL into a browser, complete login.
# 3. The CLI exits 0 after receiving the auth code via the device-code
#    poll loop; the oauth file lands at ~/.gemini/oauth_creds.json.

# 4. Capture into the GAD registry:
gad accounts add gemini --label paid-google-ai-pro
```

`GEMINI_NO_BROWSER=1` is the env-var equivalent of `--no-browser`
across recent gemini-cli builds; both forms exist depending on
release. If neither prints a URL, `GEMINI_DEBUG=1 gemini auth login`
will at least show what step is wedged.

### 2. Newer gemini-cli (>= post-2026 rewrites)

Recent gemini-cli builds shipped a proper `--code` subflag that prints
the device verification URL + a one-time-code pair, mirroring
`gcloud auth login --no-browser`:

```sh
gemini auth login --code
# Prints:
#   To authorize this machine, visit https://accounts.google.com/.../code
#   and enter the code: ABCD-EFGH
# Then waits.
```

This is the preferred flow when available. Try `gemini auth login --code`
first; fall back to `GEMINI_NO_BROWSER=1 gemini auth login` if the
subflag is rejected as unknown.

### 3. Manual file installation (works offline / when CLI auth is broken)

If the CLI auth flow is completely wedged, the canonical oauth file
format is documented at `~/.gemini/oauth_creds.json`:

```json
{
  "access_token": "ya29....",
  "refresh_token": "1//...",
  "scope": "https://www.googleapis.com/auth/cloud-platform openid email",
  "token_type": "Bearer",
  "id_token": "eyJ...",
  "expiry_date": 1747680000000
}
```

If you can complete OAuth in any other environment (vscode, gcloud,
another machine), copy the resulting oauth file to
`~/.gemini/oauth_creds.json` here, then run
`gad accounts add gemini --label <name>` to capture it into the GAD
registry. The runtime probe (`gad runtime check gemini-cli`) will
verify the token is usable for actual model calls.

## Why this is an upstream gemini-cli bug, not a GAD bug

Other CLIs (codex, claude) both print a URL by default on Windows. The
gemini auth flow specifically auto-launches `start <url>` instead of
printing to stdout when `process.stdin.isTTY` evaluates true — which it
does even in some shells where the operator cannot interact further
(WSL pipe, vscode terminal, Tauri sidecar pipe).

Upstream PRs to track:
- google/gemini-cli `--no-browser` flag stabilization
- google/gemini-cli device-flow URL print on stdout always

## Net status

- Workaround documented above is usable today by a human operator.
- Programmatic recapture inside `gad accounts add gemini` cannot drive
  the device flow non-interactively without operator browser action —
  this is fundamental to the OAuth model and is not a GAD limitation.
- The gad-credentials registry happily round-trips an oauth file
  obtained through ANY of the three paths above, so the substrate is
  unblocked the moment an operator captures one credential set.

## Cross-refs

- `lib/team/accounts-registry.cjs` — registry shape + canonical paths
- `references/multi-account-fallback.md` — overall phase 87/110 design
- Decision GLOBAL-D-313 — runtime error taxonomy (auth_failed class)
