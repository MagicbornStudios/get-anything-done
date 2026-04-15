# gad-evolution-images

Use this skill for the skill-image evolution loop:

1. Inventory coverage:
   - `gad evolution images status`
   - Optional JSON output for tooling: `gad evolution images status --json`
2. Build or edit a structured prompt list (JSON or JSONL):
   - Each item: `id`, `prompt`, `targetImagePath` (or `imagePath`)
3. Generate images only when explicitly requested:
   - `gad evolution images generate --input <file.json>`
   - or inventory-driven: `gad evolution images generate --scope official,proto`

## Safety and defaults

- Do not generate images unless explicitly asked.
- If generating, require `OPENAI_API_KEY`.
- If key is missing, instruct user to set `.env` from `.env.example`.
- Prefer `--missing-only` inventory runs first, then targeted regeneration with
  `--overwrite` only when needed.

## References

- `bin/gad.cjs` (`evolution images status|generate`)
- `.env.example`
