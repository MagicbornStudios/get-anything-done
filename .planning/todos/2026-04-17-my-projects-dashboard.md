# 'My Projects' dashboard — site + local project editor

**Source:** 2026-04-17 session 4 — dashboard direction set

User-facing project-management surface, accessible both in the local dev project-editor AND on the landing site (for logged-in users viewing their own projects).

Core views:
- List of owned projects with phase/next-action summary.
- Per-project drawer: current phase, open tasks, recent decisions, subagent-run history, BYOK env status (set / unset / last-rotated).
- Action buttons: trigger daily subagent run, view last report, open planning XML.
- Separation from /project-market (which is the public species marketplace per phase 44). This is the 'my stuff' view.

Data source: per-project planning roots via existing gad CLI readers; subagent history from session store. Needs authenticated user model on landing site (defer to landing-auth work). Local editor works unauthenticated (single-user dev box).

Dependencies:
- BYOK phase (gad-260 todo) for env status display + rotation.
- Subagent-run history storage model (new — capture per-run start/stop/tip/report and surface in dashboard).
