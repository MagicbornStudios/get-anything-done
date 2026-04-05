---
name: gad:write-intent
description: Capture user intent for a project into planning docs. Use when starting a new project or clarifying what a project is for.
---

# gad:write-intent

Captures the user's intent for a project and writes it into the right planning files so future sessions start with clear purpose.

## When to use

- Starting a new project with unclear requirements
- User describes what they want but it hasn't been written down
- A docs.project (books, listen, blog, etc.) needs its purpose documented

## Steps

1. **Identify the project**
   ```sh
   gad ls
   gad state --projectid <id>
   ```

2. **Derive intent** — ask or infer:
   - What is this project for?
   - Who uses it?
   - What does success look like?
   - What are the hard constraints?

3. **Write to REQUIREMENTS.xml** — add a `<doc>` entry with the intent as inline content or a path to a doc file

4. **Write key decisions to DECISIONS.xml** — anything that constrains how the project is built

5. **Update STATE.xml next-action** — reflect what the intent implies about what to do next

6. **Sync**
   ```sh
   gad sink sync
   ```

## Output

- Updated `.planning/REQUIREMENTS.xml` with intent doc
- Updated `.planning/DECISIONS.xml` with key constraints
- Updated `.planning/STATE.xml` with intent-informed next-action
- Sink updated with new content
