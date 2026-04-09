# Skill: Content Pack Loading

**Source:** escape-the-dungeon-bare v1
**Category:** Code pattern
**Version:** 2

## Pattern

Fetch JSON from `public/data/` at startup. Use singleton ContentManager with typed getters.
Use `import.meta.env.BASE_URL` for correct paths in both dev and production.

## When to use

Loading game data (entities, rooms, items, spells, dialogue) from JSON content packs.

## Example

```typescript
const base = import.meta.env.BASE_URL;
const entities = await fetch(`${base}data/entities.json`).then(r => r.json());
```

## Failure modes

- **404 in production but works in dev** — Vite's dev server serves from project root,
  but production build serves from `dist/`. Files in `public/` get copied to `dist/` root.
  Make sure JSON files are in `public/data/`, not `src/data/`.

- **Empty data on load** — `fetch()` doesn't throw on 404, it returns a response with
  `ok: false`. Always check `response.ok` before parsing.

- **Build works but game is blank** — If content packs fail to load silently, the game
  has no data to render. Add fallback hardcoded data so the game always shows something
  even if JSON fetch fails.

## Known fixes

- Always use `import.meta.env.BASE_URL` prefix, never hardcode `/`
- Put JSON in `public/data/`, verify they appear in `dist/data/` after build
- Add try/catch around fetch with fallback data
