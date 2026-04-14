export const REPO = "https://github.com/MagicbornStudios/get-anything-done";

export interface Critique {
  id: string;
  hypothesis: string;
  ref: string;
  steelman: string;
  problems: string[];
  alternatives: string[];
  falsification: string[];
  honestStatus: string;
}

export const CROSS_CUTTING: Array<{ title: string; body: string }> = [
  {
    title: "Sample size is too small to draw any conclusion",
    body: "Through round 4: GAD has 4 scored attempts, Bare has 5, Emergent has 2-3 fully comparable. Two data points can't establish a curve. We have been speaking about 'monotonic improvement' and 'cross-round comparison' with sample sizes that would not survive a 101-level statistics review.",
  },
  {
    title: "No randomization",
    body: "Every run uses the same agent (Claude Code), same model family, same human reviewer (the maintainer), same task domain (a roguelike game), same rubric author. Every result could be an artifact of a single decision the maintainer made about how to structure the experiment, not a property of the framework being tested.",
  },
  {
    title: "The judge is the architect",
    body: "The same person writes the requirements, designs the rubric, reviews the runs, authors the findings, and drafts the next round. This is a closed feedback loop with no external check. Even with perfect intellectual honesty, a one-person research team has no immune system against pet theories.",
  },
  {
    title: "Hypotheses are formulated AFTER seeing data",
    body: "The freedom hypothesis was named after round 2 produced an unexpected result. CSH was named after emergent v4's ratcheting cycle. None were pre-registered. We are doing exploratory analysis, not hypothesis testing — and we have not been naming it correctly.",
  },
  {
    title: "Single-task domain",
    body: "Every eval is a variant of Escape the Dungeon. We claim things about 'agent performance on creative implementation tasks.' We have evidence about agent performance on one specific game. Generalization is unverified.",
  },
  {
    title: "The rubric has changed mid-project",
    body: "Evolution 2 → 3 raised human review weight from 0.15 to 0.30. Evolution 3 → 4 reformulated as per-dimension scoring with low-score caps. Composite scores from round 1 are not directly comparable to round 4 because the formula has changed. The 'monotonic improvement' we celebrate may partly reflect rubric drift.",
  },
];

export const CRITIQUES: Critique[] = [
  {
    id: "freedom",
    hypothesis: "Freedom Hypothesis",
    ref: "gad-36",
    steelman:
      "Across rounds 2-4, bare improved monotonically (0.10 → 0.50 → 0.70 → 0.805) while GAD never exceeded 0.30 across four attempts. GAD spends 7-15% more tokens on the same task. The pattern is consistent.",
    problems: [
      "N=4 vs N=5 is not a curve. The 'monotonic improvement' is exactly the kind of pattern noise produces 1-in-16 by chance — coin-flip territory.",
      "The bare prompt has changed across rounds. Bare v1's AGENTS.md is not bare v5's. Some of bare's improvement is the requirements doc getting clearer, not the framework being absent.",
      "GAD never finished a round — gate failures or partial completions every time. We compare 'broken games' against 'working games' and call it a framework comparison. It might be a budget or runtime issue.",
      "GAD and bare may not be the same agent at all. Same model family, but different system prompts produce different behavior. The 'framework' variable is conflated with the 'system prompt' variable.",
      "GAD's design assumes multi-session work, planning loop survives compaction, decision tracking. Greenfield single-shot game implementation is exactly the workload GAD's design says is NOT the primary use case (gad-74). We chose a benchmark that disadvantages the framework we're testing.",
    ],
    alternatives: [
      "Bare's improvement is the requirements getting clearer, not the framework being absent.",
      "GAD's stagnation is single-condition variance — GAD might score 0.70 on its 5th attempt with no framework changes.",
      "The bare AGENTS.md happens to be a better prompt than the GAD AGENTS.md, independent of the planning loop.",
    ],
    falsification: [
      "A round where bare produces a worse game than GAD on the same requirements with N≥3 replicates per condition",
      "A different task domain (web app, CLI) where GAD beats bare with the same setup",
      "A pre-registered prediction that doesn't pan out",
    ],
    honestStatus:
      "Preliminary observation, single-domain, low-N, post-hoc named. Calling it a 'hypothesis' is generous; calling it a 'finding' would be irresponsible.",
  },
  {
    id: "csh",
    hypothesis: "Compound-Skills Hypothesis",
    ref: "gad-65",
    steelman:
      "Evolution 4's emergent v4 authored two new skills (dom-over-kaplay, pressure-forge-coupling), deprecated one (kaplay-scene-pattern), and documented the disposition of every inherited skill in CHANGELOG.md. Its rubric aggregate (0.885 after rescoring) was the highest of any round-4 run. First observed inherit → evaluate → evolve → document cycle.",
    problems: [
      "N=2-3 emergent runs is not a curve. v1, v2, v4 — three points cannot establish a trend.",
      "Each emergent run targeted a harder requirements version. We do not know whether emergent improved or whether the maintainer got better at writing prompts.",
      "The 6th rubric dimension (skill_inheritance_effectiveness) is human-rated by the same person who authored the rubric. We use human judgment to measure whether human-authored skills are useful. Circular.",
      "Inherited 'skills' are project-specific. dom-over-kaplay would be useless for any other game. Is that 'compounding' or just 'specialization that won't generalize'?",
      "No ablation. We have never run an emergent project that DOESN'T inherit. Until we do, we cannot tell whether emergent v4's score comes from inherited skills or simply from the agent being more capable now.",
      "CHANGELOG self-report is exactly the trust model gad-69 says we should not rely on. The agent decides what its CHANGELOG entries say.",
    ],
    alternatives: [
      "Emergent v4's score is an outlier produced by the maintainer playing more carefully on a more polished build.",
      "Skills don't compound — agents just get better at games as the agent improves.",
      "The 6th dimension is rewarding the maintainer's preference for emergent, not measuring inheritance effectiveness.",
    ],
    falsification: [
      "An emergent-no-inherit run that scores comparably to emergent-with-inherit at the same round",
      "Evolution 5 emergent scoring lower than round 4 emergent against the harder v5 requirements",
      "A second human reviewer giving meaningfully different scores",
    ],
    honestStatus:
      "First observation of a ratcheting cycle. Not enough data to claim compounding. The 6th rubric dimension is a measurement of intent to test the hypothesis, not a measurement of the hypothesis being true.",
  },
  {
    id: "emergent-evolution",
    hypothesis: "Emergent-Evolution Hypothesis",
    ref: "gad-68",
    steelman:
      "Synthesis hypothesis explaining both the freedom hypothesis and CSH with a single mechanism. The craftsman/lifter metaphor is intuitive. RepoMirror and Ralph Wiggum loop creators independently observed similar dynamics. The in-game rune/spell merge mechanic is a real-world analogue.",
    problems: [
      "It is a synthesis of two not-yet-proven hypotheses, framed as a new claim. The conjunction of two unproven things is LESS credible than either alone.",
      "The metaphor is doing the heavy lifting. Craftsman, lifter, blacksmith — good stories, not evidence. We have not shown that human craftsmanship dynamics transfer to agent skill libraries.",
      "The merge-skill primitive does not yet exist. gad-73 names create-skill / merge-skill / find-skills as the foundational triumvirate, but the audit task is unfinished. We claim the framework provides a 'substrate' while at least one of the substrate's three primitives is unbuilt.",
      "'Projects are emergent' is unfalsifiable as currently stated. What evidence could convince me a project is NOT emergent? None. That's a vibe, not a hypothesis.",
      "Repomirror and Ralph Wiggum loop observations are anecdotes. Suggestive, not evidence. We don't have their data and they don't have ours.",
    ],
    alternatives: [
      "The emergent workflow is just bare with a few extra files, and its improvement is the same bare-improvement attributed to a different cause.",
      "The 'evolution substrate' is a metaphor we like, not an observed mechanism.",
      "The synthesis is post-hoc justification for keeping the GAD framework around after the freedom hypothesis cast doubt on it.",
    ],
    falsification: [
      "A round 5 emergent run that performs WORSE than round 4 emergent against harder requirements",
      "An emergent project against a different task domain failing to compound",
      "The triumvirate audit revealing that merge-skill / find-skills don't exist and the framework is not actually providing the substrate we claim",
    ],
    honestStatus:
      "A working synthesis. Useful as a research direction. Not yet a hypothesis with stakes — we have not stated what would make us drop it.",
  },
  {
    id: "pressure",
    hypothesis: "Pressure as a measurable dimension",
    ref: "gad-75",
    steelman:
      "Naming pressure explains a lot of confusing observations: why bare improved monotonically (the maintainer was implicitly raising pressure), why GAD's gate failures clustered in early rounds, why emergent v4 felt qualitatively different from v2. It also gives us a normalization variable for cross-round comparisons.",
    problems: [
      "The formula does not exist. We call pressure 'measurable' while the measurement is currently a hand-typed constant in app/roadmap/roadmap-shared.ts. That is exactly self-report — the same problem gad-69 says we should fight.",
      "The five sub-dimensions overlap. 'Requirement complexity' and 'constraint density' are nearly synonymous. We have five labels because five sounds satisfying, not because there are five orthogonal axes.",
      "All five sub-dimensions are author-rated. The agent doesn't know what pressure level it's under. The reviewer doesn't either. Only the requirements author does — the same person rating the dimensions.",
      "Pressure-tier ratings are post-hoc and predictive simultaneously. Evolution 5's pressure rating (0.92) is in the file before round 5 has run. We will then evaluate round 5 against that prediction, creating circular validation.",
      "There is no validation step. Even if we compute pressure programmatically, we have no way to check whether it matches agent-experienced pressure.",
    ],
    alternatives: [
      "Pressure is just requirement word count.",
      "Pressure is just the maintainer's intuition about how hard a round felt.",
      "Pressure is a retrofit narrative justifying why early rounds scored lower.",
    ],
    falsification: [
      "Evolution 5 produces results inconsistent with the predicted pressure tier",
      "A second researcher rating the same requirements gives meaningfully different pressure scores",
      "A programmatic pressure score correlates poorly with the hand-rated one",
    ],
    honestStatus:
      "A useful conceptual lens. Not yet a measurement. The current presentation in /roadmap overstates how operational it is.",
  },
  {
    id: "value-prop",
    hypothesis: "GAD's value proposition",
    ref: "gad-74",
    steelman:
      "The freedom hypothesis suggests GAD doesn't beat bare on creative implementation. So we positioned GAD's value elsewhere: durable in-repo state, decisions auditable, fork-and-go, the eval framework as the load-bearing feature. This is more honest than the original framing.",
    problems: [
      "We have no evidence GAD does task management at scale BETTER than alternatives. Linear, Notion, GitHub Issues, plain markdown files — any can hold tasks in-repo or near-repo. We claim 'in-repo' is a differentiator without showing it improves outcomes.",
      "'Forkable + no SaaS' is true of any text-files-in-git system. RepoPlanner, GSD, Aider all qualify. What does GAD add over `cat .planning/state.md`? A CLI, an XML schema, a snapshot command. That's not nothing, but it's not a moat.",
      "The eval framework IS load-bearing — but we measure ourselves with our own framework. Circular validation. There is no external benchmark.",
      "'Skill security' is a future commitment, not a current feature. /security correctly says we don't host third-party skills and the certification model is a research direction. The third leg of the value prop is aspirational.",
      "The pivot from 'ship software' to 'evaluate agents' is post-hoc. It happened after round 3 made the original framing untenable. We renamed instead of shipping the original. Valid response, but should be acknowledged.",
    ],
    alternatives: [
      "'GAD is a research notebook for one person' — true and honest, smaller audience claim.",
      "'GAD is an opinionated convention for keeping decisions in repo' — true, but doesn't justify the framework overhead.",
      "'GAD is an experiment in whether task management improves agent reliability' — accurate, lower stakes.",
    ],
    falsification: [
      "A team using a non-in-repo task system (Linear) demonstrably runs better evals",
      "The eval framework reaches 10+ external contributors and we still have to defend its construction",
    ],
    honestStatus:
      "The new value prop is more defensible than the old one. Still partially aspirational (skill security) and partially circular (the eval framework validates itself).",
  },
];
