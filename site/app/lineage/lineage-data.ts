export type LineagePredecessor = {
  name: string;
  author: string;
  url: string;
  tagline: string;
  contribution: string;
  howGadUses: string;
};

export const LINEAGE_PREDECESSORS: LineagePredecessor[] = [
  {
    name: "Get Shit Done",
    author: "gsd-build",
    url: "https://github.com/gsd-build/get-shit-done",
    tagline: "The framework GAD forked from. Cross-runtime installer + planning loop + skills.",
    contribution:
      "GSD is a full framework, not just a methodology. Ships a cross-runtime installer (bin/install.js) that can target Claude Code, Cursor, Codex, OpenCode, Gemini, Copilot, Antigravity, Windsurf, Augment — nine coding-agent runtimes with one command. Plus: a structured planning loop, visible state, executable specs, and the insight that an agent is productive when it has a tight repeatable loop plus a persistent place to put its thinking. GAD's plan → execute → verify → commit cycle is descended directly from GSD's methodology, and GAD's installer is the same install.js script inherited from the GSD fork.",
    howGadUses:
      "GAD inherits the loop shape, checkpointable state, the skills-as-durable-layer principle, AND the nine-runtime installer. Where GAD diverges: the CLI is format-agnostic (XML/MD/MDX), subagents are formalized as first-class entities with their own agents/ directory, and an evaluation framework sits alongside to test whether any of this actually helps. The eval framework is the thing you won't find in GSD upstream — it's GAD's load-bearing addition.",
  },
  {
    name: "RepoPlanner",
    author: "b2gdevs",
    url: "https://repo-planner.vercel.app/",
    tagline: "First formal attempt at the Ralph Wiggum loop — keep docs and tasks in the repo.",
    contribution:
      "The earlier project by the same author that tried to solve context rot by persisting all planning artifacts — requirements, roadmap, tasks, decisions — directly in the repository. The core insight: an agent always has context if the context is committed to git. No ephemeral memory, no external databases, no chat logs that evaporate at the context window limit.",
    howGadUses:
      "GAD keeps this principle as a load-bearing invariant. Every piece of planning state lives in .planning/ as a tracked file. `gad snapshot` rehydrates the agent in one command by reading those files. The /planning page on this site is literally a render of those same files. RepoPlanner proved the approach; GAD generalized it and added the eval harness to measure whether the approach wins.",
  },
];
