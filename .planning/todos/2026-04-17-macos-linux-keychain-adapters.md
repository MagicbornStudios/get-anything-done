# macOS + Linux keychain adapters for BYOK secrets-store

**Source:** 2026-04-17 S9 — byok-design.md §15 follow-up 2

Phase 60 ships with Windows Credential Manager keychain adapter only. macOS Keychain and Linux secret-service adapters exist as stubs that throw KEYCHAIN_UNAVAILABLE so non-Windows operators fall through to passphrase mode.

Promote the stubs to real adapters when a non-Windows operator actually ships on the toolchain. Candidate implementation notes:
- macOS: shell out to /usr/bin/security add-generic-password / find-generic-password. Service name 'gad'. Account name '<projectId>.master-key'.
- Linux: shell out to secret-tool (common on gnome-keyring / kwallet via libsecret). Fall back to passphrase if secret-tool is not installed. Server/headless Linux genuinely just uses passphrase.

Could be its own phase 60.1 if it lands meaningfully later, or just appended as 60-09/60-10 tasks under phase 60 when a real operator need lands. No urgency until a non-Windows user appears.
