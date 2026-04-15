---
slug: gad-visual-context-identity
name: GAD Visual Context Identity
description: UI development workflow where every user-facing region gets a source-searchable identity literal (`SiteSection cid="..."` / `Identified as="..."`) so the Dev Panel → copy-token → agent-prompt handoff path works. The bridge between what a human sees in the UI and what a coding agent can unambiguously act on from source.
trigger: A component, section, page, or route is being added, restructured, or reviewed in a project that uses the Visual Context Panel system — OR the operator reports "I copied a token from the dev panel and can't find it in source" or a CI audit flags `SiteSection` without `cid=`.
participants:
  skills: [gad-visual-context-system, gad-visual-context-panel-identities]
  agents: [default]
  cli: []
  artifacts: [site/components/site/SiteSection.tsx, site/components/devid/Identified.tsx, site/components/devid/DevPanel.tsx, site/components/devid/DevIdAgentPromptDialog.tsx, site/app/**/page.tsx]
parent-workflow: gad-loop
related-phases: [44, 44.5]
---

The Visual Context Panel is a dev-only overlay that lets the operator
hover a UI region, copy a stable source-search literal, and hand that
literal off to a coding agent as a landmark. It only works if the
landmark appears **verbatim in a source file** — no runtime-generated
ids, no template-literal concatenation, no `useId()`. Decision gad-187
locks `SiteSection cid="<route>-<section>-site-section"` as the
default section identity; `Identified as="<ComponentName>"` handles
inner landmarks more specific than the section shell.

This workflow is the development-time discipline that keeps the
invariant true as the UI grows. Every new section, every new route,
every component rename walks through it. The `gad-visual-context-system`
skill is the policy source of truth; this workflow is the expected
graph the trace pipeline matches against when mining `/planning`
Workflows tab.

The operator-facing loop is: (1) bring up the dev-server with the Dev
Panel mounted, (2) hover the target region in the browser, (3) click
the token to copy it, (4) paste-search the token in the editor and
confirm exactly one hit in source. Zero hits = typo or runtime id.
Multiple hits = ambiguity that needs a route-qualified literal. The
single-hit invariant is what the agent-prompt handoff rides on.

```mermaid
flowchart TD
  A[new section / route / rename lands] --> B[wrap in SiteSection cid=route-section-site-section]
  B --> C[add Identified as=ComponentName for inner landmarks]
  C --> D[dev-server up, Dev Panel mounted]
  D --> E[hover target, click to copy token]
  E --> F[paste-search token in editor]
  F --> G{one source hit?}
  G -->|zero| H[fix typo or remove runtime id]
  G -->|multi| I[qualify with route slug]
  G -->|one| J[copy-with-agent-prompt handoff]
  H --> F
  I --> F
  J --> K[agent edits the exact landmark]
```
