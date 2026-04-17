# Installed gad runtime missing teachings/ tree — tip CLI fails ENOENT

**Source:** 2026-04-17 session 4 — teachings reader landing

Reproducer: 'gad tip reindex' using the installed binary at %LOCALAPPDATA%/Programs/gad/bin/gad.exe fails with ENOENT because C:/Users/benja/.gad/runtime/1.33.0/teachings/index.json does not exist. The release-support build tree at vendor/get-anything-done/scripts/build-release-support.mjs does not copy the teachings/ directory into the runtime bundle. Workaround during this session: invoked source CLI directly via 'node vendor/get-anything-done/bin/gad.cjs tip reindex'. Fix: update build-release-support.mjs to include teachings/ in the bundled runtime tree alongside skills/workflows/etc. Or: tip CLI should look up the tree for a project-scoped teachings/ root before falling back to the bundled runtime.
