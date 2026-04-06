---
name: gad:write-intent
description: Capture user intent for a project into planning docs. Use when starting a new project, clarifying what a project is for, or when requirements are missing or vague.
---

# gad:write-intent

Captures the user's intent for a project and writes it into the planning files so future sessions start with clear purpose.

## When to use

- Starting a new project with unclear requirements
- User describes what they want but it hasn't been written down
- A docs.project needs its purpose documented
- Requirements exist but don't reflect what the user actually wants

## Step 1 — Identify the project

```sh
gad ls                           # list all projects
gad state --projectid <id>       # current state if project exists
```

If the project doesn't exist yet, use `gad projects init` to scaffold it first.

## Step 2 — Derive intent

Ask or infer these from conversation context:

| Question | Where it goes |
|----------|--------------|
| What is this project for? | REQUIREMENTS.xml — top-level `<goal>` |
| Who uses it? | REQUIREMENTS.xml — `<audience>` |
| What does success look like? | REQUIREMENTS.xml — `<success-criteria>` |
| What are the hard constraints? | DECISIONS.xml — constraint decisions |
| What is explicitly out of scope? | REQUIREMENTS.xml — `<non-goals>` |

Don't ask all 5 if the answers are obvious from context. Derive what you can, ask about what you can't.

## Step 3 — Write to REQUIREMENTS.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<requirements>
  <goal>One-sentence project purpose</goal>
  <audience>Who uses this and why</audience>
  <success-criteria>
    <criterion>Measurable outcome 1</criterion>
    <criterion>Measurable outcome 2</criterion>
  </success-criteria>
  <non-goals>
    <item>Thing explicitly not in scope</item>
  </non-goals>
  <docs>
    <doc path="path/to/requirements.mdx" role="narrative" />
  </docs>
</requirements>
```

If REQUIREMENTS.xml already exists, update it — don't replace unless the user says to start fresh.

## Step 4 — Write key decisions

Any constraint that came up during intent capture goes to DECISIONS.xml:

```xml
<decision id="proj-01">
  <title>Short decision title</title>
  <summary>What was decided and why</summary>
  <impact>How this constrains future work</impact>
</decision>
```

## Step 5 — Update STATE.xml

Set `next-action` to reflect what the intent implies should happen next. Example: "Intent captured. Next: plan phase 01 based on requirements."

## Step 6 — Sync

```sh
gad sink sync
```

## Example output

For a project called "listen" with intent "music portfolio with BandLab integration":

**REQUIREMENTS.xml** gets: goal = "Curated music portfolio surface", audience = "Portfolio visitors, artist collaborators", success = "BandLab tracks playable inline, preset descriptions editorial quality", non-goals = "DAW features, upload functionality".

**DECISIONS.xml** gets: "listen-01: BandLab is the only music source — no upload, no SoundCloud".

**STATE.xml** gets: next-action = "Intent captured. Plan phase 01: catalog data model and BandLab API integration."
