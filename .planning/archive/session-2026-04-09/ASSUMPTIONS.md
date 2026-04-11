# Project Assumptions

**Owner:** Claude Code + repo owner.
**Anchor decisions:** [gad-74](DECISIONS.xml) (GAD value prop), [gad-75](DECISIONS.xml) (pressure as measurable dimension), [gad-76](DECISIONS.xml) (target users + value prop framing), [gad-77](DECISIONS.xml) (contribution flow is human-first).
**Purpose:** Single document answering "who, what, why, how" so IA, content tone, and feature priority all stop being ad-hoc.
**Last updated:** 2026-04-09.

---

## Who is this for?

### Primary user: A — Coding-agent researchers

People evaluating skill frameworks, hypothesis quality, and measurement rigor across coding-agent platforms. Academic-ish. Reads findings. Cares about methodology. Will scrutinize the rubric, the gates, the trace schema, and whether the conclusions actually follow from the data. Reads the open questions to probe for intellectual honesty.

**Primary user assumptions:**
- Already familiar with Claude Code / coding-agent terminology.
- Will click through to DECISIONS.xml and REQUIREMENTS.xml on GitHub to verify claims.
- Cares more about "how do we know this?" than "what's the result?"
- Will get frustrated by marketing copy. Wants precision.

### Secondary user: C — Indie devs curious about skill evolution

People who want an experiential entry point — "let me play the game the agent built and see if skill evolution is a real thing." Secondary because the experiential hook works best when the research is already visible; they find the site through playable demos and stay because the research is transparent.

**Secondary user assumptions:**
- Will click Play first and Read second.
- Probably not familiar with Claude Code hooks, trace schema, rubric construction.
- Needs jargon wrapped in Term tooltips (already live per /glossary).
- Should be able to start a conversation with an agent and run their own experiment within an hour of cloning.

### Who this is NOT for (yet)

- Enterprise teams evaluating agent tooling for compliance/procurement. We're not ready to support that conversation — no SLAs, no vendor-grade docs, no support path.
- Framework authors building a GAD-alike. They can fork, but we're not documenting internals as a "reuse this" story yet.

---

## What is the value proposition?

**Working framing:** *"A system for evaluating and evolving agents through real tasks, measurable pressure, and iteration."*

This combines three load-bearing ideas:

1. **Evaluating agents through real tasks** — not benchmarks, not toy examples. The escape-the-dungeon family is load-bearing because it's a complete authored game that actually has to work, not a unit-test fixture.
2. **Measurable pressure** — see next section. This is the **new** thing that differentiates GAD from "another coding-agent framework." Pressure is the axis that connects game-feel, requirements, and eval rigor.
3. **Iteration** — the eval framework is designed around rounds, requirement versions, and compound learning (compound-skills hypothesis). A one-shot run doesn't tell you anything useful; a trajectory across rounds does.

**Explicitly NOT the value prop:** "Use GAD to ship software faster." Per gad-74, the freedom hypothesis already suggests bare agents outperform framework-driven ones on greenfield creative implementation. GAD's value is in the **measurement layer** and the **task-management-at-scale** substrate — not in making a single agent run produce better code.

---

## Pressure as a first-class evaluation dimension (new)

**Core claim:** Pressure is the hidden axis that connects everything the project has been circling. It's what the requirements have been implicitly encoding, what the game design has been trying to deliver, and what the eval rubric has been partially measuring. Formalizing it as its own dimension lets us reason about agent performance in a way quality scores alone cannot.

**Definition (working):**

> **Pressure** = the constraint intensity applied to the agent during an eval. It is the composite of requirement complexity, ambiguity, constraint density, iteration budget, and failure cost.

### Five dimensions of pressure

1. **Requirement complexity** — number of moving parts, cross-system interactions, depth of logic required. Round 1 had 12 flat criteria; round 5 has 21 + v4 base = ~40 criteria with cross-cutting concerns. Pressure rises.
2. **Ambiguity** — clarity of instructions, missing information, interpretation required. Bare requirements are higher-ambiguity than GAD's planning-doc-assisted ones.
3. **Constraint density** — hard rules the agent must obey. Authored-only (no procgen), gate criteria, stack lock-in. Density rises when constraints pile up without contradicting each other.
4. **Iteration budget** — how many tool uses, how many commits, how many retry passes. Rate limits and HTTP 529 crashes impose an upper bound; token budget is the natural floor.
5. **Failure cost** — does failure matter? Is it visible? Irreversible? Cascading? A gate failure that zeroes `requirement_coverage` is a high-failure-cost mechanic; a scored dimension missing a feature is a low-failure-cost mechanic.

### Why pressure matters

| System piece | How it connects via pressure |
|---|---|
| **Game feel** | Players feel pressure as challenge. Ingenuity requirement is pressure on the player, not the agent. |
| **Eval framework** | Pressure becomes a measurable independent variable — we can ask "how did agent X perform under pressure level Y" instead of just "what score did X get." |
| **Skill evolution** | Skills emerge from pressure. Fundamentals hold up under pressure; merges fail when the pressure is orthogonal to the fundamental. |
| **Requirements** | Requirement versions implicitly encode pressure levels. v1 was low pressure; v5 is high pressure. Rounds ARE pressure tiers. |
| **Findings** | "Agent performed at 0.80 quality" is less useful than "agent performed at 0.80 quality under pressure tier 3." Cross-round comparison is a pressure-normalized comparison. |

### Open questions about pressure

- How do we compute a pressure score per eval operationally? See `data/open-questions.json` — new entry.
- Should pressure become its own scored dimension in the rubric, or stay as metadata attached to the requirements version?
- How do we validate that a pressure level is what we say it is? (Self-rating by the requirements author is suspect.)

### What pressure does NOT mean

- It's not a difficulty slider the player adjusts.
- It's not a replacement for the rubric — pressure is metadata about the test conditions, not a measurement of the result.
- It's not only about the game. Pressure applies equally to brownfield refactors, tooling evals, and multi-agent coordination runs.

---

## Site information architecture assumptions

Every choice below maps directly to a user answer and has a reason attached.

### 1. Primary CTA is "Play"

**Why:** Interactive proof beats explanation. The strongest thing we have is playable builds of round 4's three conditions running in the browser. Leading with Play converts a visitor into a participant in the first 30 seconds. Research framing sits beneath it for anyone who wants it.

### 2. Navigation is five dropdowns + search

**Why:** 14 flat items was breaking on mobile and confusing on desktop. Grouping aligns with mental model: **Theory** (why), **Evaluation** (what), **Catalog** (who), **Play** (experience), **System** (how to participate). Search solves the "I know the term but not where it lives" problem.

Groups:

- **Theory** — GAD, Lineage, Methodology, Glossary
- **Evaluation** — Findings (first), Rubric, Results (#), Graphs (#), Decisions, Questions, Roadmap
- **Catalog** — Skills, Agents, Commands, Templates
- **Play** — Playable Archive, Videos
- **System** — Planning, Security, Contribute
- **+** top-level Emergent link (per Q9-D)
- **+** Search icon

### 3. Routing is hybrid anchor + modal

**Why:** Fast scanning wants anchors. Deep inspection wants a modal that shows the full entry with copy + GitHub link. Both are cheap if we build the modal as a client component and keep the index page SSG. See `<Ref>` component for the primary interface.

### 4. Search indexes structured entries only

**Why:** Full-text is expensive and noisy. Structured entries (decisions, glossary, questions, bugs, skills, agents, commands, requirements) is the high-signal subset. Index emitted at prebuild into `data/search-index.json`. Client uses a tiny fuzzy matcher.

### 5. Skills directory shows parsed frontmatter + markdown body, with **provenance** emphasized

**Why:** Per Q6-B + tweak. Provenance includes:
- originating run (which eval first authored this skill)
- inheritance lineage (which runs inherited it, in what order, with what disposition in CHANGELOG)
- evaluation performance context (rubric scores for runs that used it)
- hypothesis context (which hypothesis this skill is evidence for)

This is the single most important UX decision because it makes the Compound-Skills Hypothesis visible at the skill level.

### 6. Emergent is first-class everywhere

**Why:** Per Q9-D. Dedicated `/emergent` page rolling up all CSH evidence. Top-level nav presence. Filters across Results/Graphs/Findings. This is not a feature — it's the hypothesis-proving layer.

### 7. Data provenance is both inline and indexed

**Why:** Per Q10-C. Every chart gets a caption showing its source field in TRACE.json plus the derivation formula. A dedicated `/data` page indexes every chart with a downloadable JSON link. Trust is load-bearing for research credibility.

### 8. Contribution path is human-first, minimal

**Why:** Per Q11-A and the user's clarification: snapshot is agent-facing, not human-facing. A human who clones the repo doesn't run snapshot — they open Claude Code, use the GAD skills already installed, and have a conversation. The contribution page must:

- Tell humans what to do (clone → npm install → open Claude → talk conversationally)
- Explain what agents do (snapshot → planning loop → commit) so humans know the difference
- Not require any process overhead (no PR template, no rubric, no eval submission form)

Open task: test the contribution flow on a fresh clone in a new repo to verify skills are actually present and usable.

### 9. Security is A + provenance surface + future certification

**Why:** Per Q12-B. Immediate ship is `/security` covering typosquatting, skill-attack vectors, our eval approach, link to Anthropic skills guide. Medium-term: a skill provenance surface showing origin run + inheritance + evaluation context (overlaps with skills directory). Future-term: skill certification — "skills produced and verified by this system are considered safe because they were built under measured pressure and pass our provenance checks." That's a whole research program; we just make sure the data model allows it.

---

## Skill certification (future direction — not yet built)

This came up in the IA conversation and is important enough to capture as a seed direction:

**Core idea:** A skill produced inside this system can carry a certification that it was built under measured pressure, passed provenance checks, and its performance context is verifiable. The certification is a claim about the skill's **build process**, not its **code behavior** — it's closer to "signed source + reproducible build" than to "malware scan."

**What a certified skill would need:**
- Originating run ID (the run that authored it)
- Pressure level the originating run operated under
- Rubric scores for the originating run
- Inheritance lineage (what fundamentals it was merged from)
- CHANGELOG disposition across inheriting runs (does it keep getting kept, or does it keep getting deprecated?)
- A signed manifest or hash chain so the certification is tamper-evident

**What we'd build first:** the data model for provenance on each skill's frontmatter. Everything else (signing, verification, public registry) is later.

**Why this matters to the landing page:** if/when certification works, the value prop changes from "we evaluate agents" to "we evaluate agents AND the skills they produce are trustable because of how they were built." That's a substantially bigger claim and one of the few things in this space that could justify an enterprise conversation.

---

## What's DEFERRED from this assumptions doc

These were considered and explicitly deferred, so future-you doesn't have to re-debate them:

- **Enterprise-grade docs** — defer until there's an enterprise-interested user actually asking.
- **Paid tier / hosted service** — not happening. GAD is forever in-repo + forkable.
- **Pressure score formula implementation** — decision gad-75 captures the dimensions; the formula + collection is a separate task.
- **Codex vs Claude comparison eval** — task 89, defer until round 5 ships against v5.
- **Brownfield requirements v5** — v5 is greenfield-only for round 5. Brownfield picks up later.
- **Skill certification implementation** — data model first, everything else follows.
- **/tasks, /bugs, /phases** pages — batch 2, after batch 1 ships.
- **Skills directory full refactor** — batch 3, needs provenance data piped in first.

---

## How this document is used

- **When planning a new feature:** check if the feature serves primary user A or secondary user C. If neither, it's probably out of scope.
- **When writing copy:** use the value-prop framing. Lead with measurement + pressure. Don't lead with shipping speed.
- **When adding a nav item:** decide which of the five groups it belongs in. If it doesn't fit, the grouping might need to change — but default is "make it fit."
- **When a user asks "what's GAD for":** the answer is decision gad-74 plus the pressure framing, not "a better way to build software."
