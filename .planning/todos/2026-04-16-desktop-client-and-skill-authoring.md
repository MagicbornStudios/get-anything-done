# Desktop Client + Skill Authoring Workflow

**Source:** Session 2026-04-16c (decision gad-218)

## Desktop client

- Local-first project management tool
- Users bring their own coding agent (Claude Code, Cursor, etc.)
- White glove setup experience
- Windows first-class
- Essentially: site + editors + local filesystem access as standalone app
- Published artifacts go to hosted platform
- Build pipeline stays local (no server builds)

## Skill authoring workflow

Users want to:
- Author a set of skills without installing them
- Branch off skills and try them in isolation
- Test skills in editors before committing
- Species carry skill sets — editing a species means editing its skills

Current gap: no way to "draft" skills without installing. Need:
- Skill drafting workspace (maybe .planning/proto-skills/ is already this?)
- Skill branching — fork a skill, modify, test, merge back
- Skill testing in editors — run a generation with draft skills

## Platform model

- Local desktop: build, edit, manage, test
- Hosted platform: publish projects, species, generations
- Users can use their own coding agent subscriptions
- Cloud editors possible if cheap, but local-first default
- Platform hosts published artifacts only

## Next step

Review existing installer work (decision gad-188). Check proto-skills mechanism.
