---
name: gad:set-profile
description: Switch model profile for GAD agents (quality/balanced/budget/inherit)
argument-hint: <profile (quality|balanced|budget|inherit)>
model: haiku
allowed-tools:
  - Bash
---

Show the following output to the user verbatim, with no extra commentary:

!`node "vendor/get-anything-done/get-shit-done/bin/gsd-tools.cjs" config-set-model-profile $ARGUMENTS --raw`
