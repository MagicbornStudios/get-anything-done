# Audit apps/portfolio current state before archiving as RE species

**Source:** session 2026-04-17 strategy pivot

Per decision gad-235 + phase 50.1.

Before converting apps/portfolio into a public reverse-engineering target species, audit its current state:

## Things to verify

- Is it deployed? Where?
- What Vercel project does it belong to?
- What public URL?
- What dependencies does it have (auth, db, APIs)?
- Is there any in-progress work that shouldn't be frozen?
- How much of the code is portfolio content vs framework scaffolding?

## Output

A short audit note in .planning/notes/ describing current state. Then decide:

- Freeze as-is and point the RE species at the snapshot?
- Or clean up first, then freeze?
- Or extract the useful content before freezing?
