<workflow slug="proto-skill-battery" name="Proto-skill discoverability + supersession battery">

<objective>
Per-proto-skill fitness test. For every staged proto-skill or
promoted-from-proto skill in the current project, measure three things:

1. **Findability** — can a cold agent discover this skill from a paraphrased
   version of its own trigger? Mirrors `gad:discovery-test` arm 1.
2. **Execution sufficiency** — is the workflow body self-contained enough for
   the agent to rate it executable without further research?
3. **Supersession / shed score** — does any OTHER proto-skill in the same
   project cover the same trigger better, making this one an eviction
   candidate? Proto-vs-proto comparison, NOT proto-vs-canonical (canonical is
   framework-specific; projects have their own ecosystems that grow and
   obsolete each other).

Output: `site/data/proto-skill-findings.json` machine-readable per-proto scores
+ `.planning/notes/proto-skill-battery-{date}.md` human writeup. Operator
reviews shed candidates and runs `gad evolution shed <slug>` manually — the
battery never mutates canonical state, it only produces evidence.
</objective>

<inputs>
  <param name="date" type="string" required="false" default="today">ISO date for the findings filename</param>
  <param name="scope" type="enum" required="false" default="project">project | proto-only | promoted-from-proto | all</param>
  <param name="shed_flag_threshold" type="float" required="false" default="0.5">shed_score at which a proto-skill gets flagged for review</param>
  <param name="shed_recommend_threshold" type="float" required="false" default="0.75">shed_score at which the battery explicitly recommends eviction</param>
</inputs>

<outputs>
  <file>.planning/notes/proto-skill-battery-&lt;date&gt;.md</file>
  <file>site/data/proto-skill-findings.json</file>
  <metric name="proto_count" type="int"/>
  <metric name="mean_findability" type="float"/>
  <metric name="mean_execution_sufficiency" type="float"/>
  <metric name="mean_shed_score" type="float"/>
  <metric name="shed_flagged" type="int"/>
  <metric name="shed_recommended" type="int"/>
</outputs>

<process>

<step id="1" name="enumerate-protos" tool="gad skill list --proto">
Build the target list. Default scope is `project`: all skills that either
live under `.planning/proto-skills/<slug>/` OR carry `status: proto` /
`origin: promoted-from-proto` frontmatter in `skills/<name>/`. Other scopes:

- `proto-only` — only staged proto-skills (not yet promoted)
- `promoted-from-proto` — only promoted skills that still carry proto provenance
- `all` — union of both, plus any skill with a `source_phase:` or
  `source_evolution:` frontmatter key (marks organic origin)

Skip canonical-from-birth skills — they're out of scope for this battery.
</step>

<branch if="target_list.length == 0">
  <step id="1a" name="exit-no-protos">No protos to test. Exit cleanly with a zero-proto findings file.</step>
</branch>

<else>
  <loop for="proto in target_list" id="per-proto-loop">

    <step id="2" name="paraphrase-trigger" skill="(inline rephraser)">
      Spawn a small third-party rephraser agent (or do it inline with a
      prompt) that takes the proto-skill's `description:` frontmatter and
      produces a paraphrased user intent that does NOT mention the skill's
      name. Example:
      description: "Build and maintain a UX pattern for visual-context
      identity in any app..."
      →
      paraphrase: "I need a way to click on any component in my dev build
      and have the coding agent know which component it is."

      The paraphrase becomes the trigger the cold agent receives.
    </step>

    <parallel id="per-proto-arms">

      <step id="3a" name="findability-arm" tool="Agent (subagent)" output="findability_result">
        Spawn a cold `general-purpose` subagent with the same restrictions as
        `gad:discovery-test`: Bash only for `gad` CLI, Read only on
        CLI-surfaced paths, no Glob/Grep, no CLAUDE.md/AGENTS.md. Task prompt
        is the paraphrased trigger. The agent must (a) discover the proto-skill
        via `gad skill find <keywords>` + `gad skill show <slug>`, (b) read
        the SKILL.md + workflow body, (c) rate confidence 0-10 that the
        workflow is sufficient to execute end-to-end, (d) report the discovery
        path as a read-chain.

        READ-ONLY RULE: the agent may NOT invoke write-side verbs
        (promote/install/validate/discard, eval setup/run/preserve/review,
        task add, commit). Enforced by agent prompt per task 42.2-31.
      </step>

      <step id="3b" name="supersession-arm" tool="Agent (subagent)" output="supersession_result">
        Spawn a second cold `general-purpose` subagent. Prompt: "The user has
        this intent: {paraphrase}. Search ALL proto-skills in the current
        project via `gad skill list --proto` and `gad skill find <keywords>`.
        Rank the proto-skills by fit to the intent. Report: which proto-skill
        is the BEST fit for this trigger, and how does the target proto-skill
        {slug} rank? If another proto-skill is a stronger fit, report its
        slug + score."

        The target proto's position in this ranking drives the shed_score:
        - target is #1 → shed_score = 0.0 (still earning its place)
        - target is #2 (tied) → shed_score = 0.3 (competitive)
        - target is #2 (not tied) → shed_score = 0.5 (flag for review)
        - target is #3+ → shed_score = 0.75 (recommend eviction)
        - target not in top-3 → shed_score = 1.0 (superseded outright)

        READ-ONLY RULE applies here too. No write-side verbs.
      </step>

    </parallel>

    <step id="4" name="score-per-proto">
      Compute the three scores from the arm outputs:
      - `findability` = agent A's confidence (0-10)
      - `execution_sufficiency` = agent A's rating of workflow body (0-10)
      - `shed_score` = from the arm-2 ranking logic above (0.0-1.0)

      Append a per-proto record to the rolling findings object with
      {slug, paraphrase, findability, execution_sufficiency, shed_score,
      findability_read_chain, supersession_rank, stronger_alternative_slug}.
    </step>

  </loop>
</else>

<step id="5" name="aggregate">
  Compute fleet-level metrics:
  - `mean_findability` = avg across all protos
  - `mean_execution_sufficiency` = avg
  - `mean_shed_score` = avg
  - `shed_flagged` = count with shed_score >= shed_flag_threshold (default 0.5)
  - `shed_recommended` = count with shed_score >= shed_recommend_threshold (default 0.75)
</step>

<step id="6" name="write-findings" tool="Write">
  Write human-readable writeup to
  `.planning/notes/proto-skill-battery-{date}.md`. Sections:

  1. Summary table (one row per proto: slug, findability, exec sufficiency, shed)
  2. Shed candidates (protos with shed_score >= flag threshold) — explicit
     eviction recommendations for the operator to review
  3. Fleet metrics
  4. Per-proto read-chain details
  5. Comparison to previous run (if prior findings file exists) — delta
     tracking for shed_score trajectories
</step>

<step id="7" name="write-site-data" tool="Write">
  Emit `site/data/proto-skill-findings.json` matching the discovery-findings
  schema shape so the planning site can render both in the same Discovery
  tab (different sub-section). Include:

  ```json
  {
    "timestamp": "...",
    "schema_version": 1,
    "proto_count": N,
    "fleet_metrics": {...},
    "protos": [
      {
        "slug": "...",
        "paraphrase": "...",
        "findability": 0-10,
        "execution_sufficiency": 0-10,
        "shed_score": 0.0-1.0,
        "status": "healthy" | "flagged" | "shed-recommended",
        "findability_read_chain": [...],
        "supersession_rank": N,
        "stronger_alternative_slug": "..." | null
      }
    ],
    "shed_candidates": [...],
    "previous_run": {...}
  }
  ```
</step>

<step id="8" name="never-mutate" tool="(assertion)">
  CRITICAL: the battery never runs promote, install, discard, or shed CLI
  verbs. It reports shed candidates; the operator decides whether to act.
  This is the hard lesson from task 42.2-31 where Agent E executed the full
  candidate-to-canonical pipeline unprompted. Write-side mutation belongs to
  the operator.
</step>

</process>

<references>
  <ref>skills/gad-discovery-test/SKILL.md — the canonical battery this parallels</ref>
  <ref>workflows/discovery-test.md — read-only agent prompt template (reuse)</ref>
  <ref>references/skill-shape.md §11 — skill lifecycle</ref>
  <ref>decision gad-196 — framework canonical vs project-specific skill distinction</ref>
  <ref>decision gad-183 — proto-skills stage inside .planning/</ref>
  <ref>bin/gad.cjs skill find/show/list --proto — the CLI surface agents use</ref>
</references>

<notes>
- The paraphrase step is essential. If the agent sees the proto-skill's own
  description as the trigger, findability becomes trivial (substring match
  finds the skill immediately). The paraphrase forces the agent to work from
  intent, not keywords.
- The supersession arm is proto-vs-proto only. Do NOT compare against
  canonical skills — that's framework-level thinking and defeats the purpose
  of the project-specific proto-skill ecosystem.
- Automatic cadence: wire this as step 9 of `workflows/evolution-evolve.md`
  so every evolution cycle produces fresh battery data. Manual invocation
  via `gad discovery-test --proto` for ad-hoc runs.
- Cost: ~2 cold agents per proto × ~50k tokens each = ~100k per proto.
  A project with 10 proto-skills → ~1M tokens per battery run (~$3-6 on
  Opus, ~$0.50-1 on Sonnet). Run after evolve cycles, not on every commit.
</notes>

</workflow>
