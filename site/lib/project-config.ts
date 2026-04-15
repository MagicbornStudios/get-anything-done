// Task 44-30 (decision gad-188): registered GAD projects for the site.
//
// This module re-exports a build-time snapshot emitted by
// `scripts/build-site-data.mjs` into `project-config.generated.ts`. The
// generator walks upward from REPO_ROOT looking for a `gad-config.toml` that
// declares `[[planning.roots]]` or `[[evals.roots]]` and captures every
// entry. No runtime toml parsing — this file is pure static data.
//
// See decision GAD-D-188 for the umbrella scope (44-28 installer + release
// pipeline + data scoping) and sub-task 44-30 / 44-28.A1 for the specific
// data-scoping contract this powers.

export type { RegisteredProject } from "./project-config.generated";
export {
  REGISTERED_PROJECTS,
  DEFAULT_PROJECT_ID,
} from "./project-config.generated";
