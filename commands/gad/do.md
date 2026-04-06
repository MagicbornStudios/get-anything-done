---
name: gad:do
description: Route freeform text to the right GAD command automatically
argument-hint: "<description of what you want to do>"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---
<objective>
Analyze freeform natural language input and dispatch to the most appropriate GAD command.

Acts as a smart dispatcher — never does the work itself. Matches intent to the best GAD command using routing rules, confirms the match, then hands off.

Use when you know what you want but don't know which `/gad:*` command to run.
</objective>

<execution_context>
@vendor/get-anything-done/get-shit-done/workflows/do.md
@vendor/get-anything-done/get-shit-done/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
Execute the do workflow from @vendor/get-anything-done/get-shit-done/workflows/do.md end-to-end.
Route user intent to the best GAD command and invoke it.
</process>
