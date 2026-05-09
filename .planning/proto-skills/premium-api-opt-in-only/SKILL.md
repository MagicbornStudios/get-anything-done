---
status: proto
workflow: ./workflow.md
description: Features that multiply premium-API calls must be opt-in via explicit env flag, never default-on
triggers:
  - building features that fan out to multiple LLM providers
  - designing health probes
  - A/B comparison features
  - dual-generate or multi-model features
---

# Premium API Opt-In Only

## When to use
Any time you build, review, or merge a feature that results in MORE than one LLM/premium-API call per user action. Includes: multi-provider fan-out, A/B model comparison, dual-generate, health probes with paid-endpoint fallback.

## Why this matters
Kael's dual-generate feature was default-on and doubled Anthropic spend per chat submit (GLOBAL-D-332). The operator didn't notice until the spend ledger flagged the anomaly. For features that multiply cost, the operator must consciously choose to enable them. Health probes are a separate trap: a probe that silently falls back to a paid endpoint when the free one is down turns a monitoring tool into a silent cost multiplier.

## Triggers
- "building dual-generate or multi-model feature"
- "fan-out to multiple providers"
- "health probe calling external API"
- "A/B model comparison"
- "feature doubles API spend"

## Success criteria
- Feature is off when env flag is absent (not default-on via fallback string)
- Cost profile documented in config comment
- Health probes call only free/internal endpoints; no paid-endpoint fallback
- Code review grep finds zero ungated paid-API call paths

## Anti-patterns
- `process.env.FLAG || 'true'` — default-on via string fallback
- Health probe: `if (!freeEndpoint) callPaidEndpoint()`
- Flag gates the UI but not the underlying API call
- Shipping without documenting the cost multiplier

## See also
- GLOBAL-D-332
- `.planning/datasets/ai-spend-ledger/` (spend tracking)
- `apps/desktop/src/components/kael/KaelFocusMode.tsx` (reference: dual-generate removal)
