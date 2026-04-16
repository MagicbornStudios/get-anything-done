# GAD CLI AI Generation Fundamentals

**Source:** Session 2026-04-16c (decision gad-217)

## Commands needed

```
gad generate image --prompt "pixel art dungeon tileset" --out assets/media/tileset.png
gad generate audio --prompt "8-bit victory fanfare" --out assets/audio/victory.wav
gad generate video --prompt "30s project trailer" --out assets/video/trailer.mp4
gad generate text --prompt "game dialogue for shopkeeper" --out data/dialogue-shopkeeper.json
```

## Design

- One-shot: prompt in, file out. No agent loop.
- Provider-agnostic: OpenRouter for routing, or direct API keys
- Config in gad-config.toml: `[generation]` section with provider, model, API key ref
- Feeds into project assets/ convention (decision gad-210)
- Output formats configurable (png/jpg/webp, wav/mp3, mp4/webm, md/json/txt)

## Dependencies

- Need API key management (env vars or config)
- Need provider SDK (OpenRouter TypeScript SDK or fetch-based)
- Image: DALL-E, Stable Diffusion, Flux
- Audio: Suno, ElevenLabs, or local
- Video: Runway, Pika, or Remotion for programmatic
- Text: Claude, GPT, or any LLM via OpenRouter

## Next step

Start with `gad generate text` — simplest, most useful, no binary handling.
