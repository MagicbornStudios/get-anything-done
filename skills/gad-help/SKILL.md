---
name: gad:help
description: Show available GAD commands and usage guide
---
<objective>
Display the complete GAD command reference.

Output ONLY the reference content below. Do NOT add:
- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<execution_context>
@vendor/get-anything-done/workflows/help.md
</execution_context>

<process>
Output the complete GAD command reference from @vendor/get-anything-done/workflows/help.md.
Display the reference content directly — no additions or modifications.

Note: GAD commands use the `gad:` prefix. The following commands have been removed from GAD
(use the `gad` CLI instead): workstreams, list-workspaces, new-workspace, remove-workspace,
ui-phase, ui-review, secure-phase, pr-branch, ship, profile-user.
</process>
