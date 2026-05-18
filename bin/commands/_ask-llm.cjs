'use strict';
/**
 * gad ask llm — LLM Q&A routing with context-index injection (2026-05-10 / phase 245-07).
 *
 * Before calling the LLM, queries the context-index for top-3 relevant chunks
 * and injects them as a "Prior context:" block in the system prompt.
 * Use --no-context to skip retrieval (old literal-question behaviour).
 *
 *
 * Operator UX: `gad ask "what is GLOBAL-D-330"` (top-level positional in
 * ask.cjs delegates here) OR `gad ask llm "..."` (explicit).
 *
 * Backend resolution (--backend):
 *   auto     — pick first reachable in priority order below
 *   modal    — Modal vLLM endpoint via MODAL_VLLM_URL (OpenAI-compatible POST)
 *   gateway  — Vercel AI Gateway via AI_GATEWAY_API_KEY (model 'anthropic/claude-sonnet-4-6')
 *   direct   — Anthropic direct via ANTHROPIC_API_KEY (@ai-sdk/anthropic)
 *
 * Priority: modal > gateway > direct (per gad_ask_moe_entry_point design).
 *
 * Output: stream tokens to stdout as they arrive.  --json buffers and emits
 *   { backend, model, text, durationMs, error? }.
 *
 * System prompt now has two layers:
 *   1. Soul framing + "no RAG" disclaimer (preserved from MVP, used when --no-context)
 *   2. Context block prepended from context-index top-3 hits (new default)
 */

const path = require('node:path');
const { defineCommand } = require('citty');
const { checkBudget, truncateToBudget, budgetForModel, estimateTokens } = require('../../lib/token-budget/index.cjs');

// ── Backend detection ────────────────────────────────────────────────────────

function detectBackends() {
  const out = { modal: false, gateway: false, direct: false };
  if (process.env.MODAL_VLLM_URL) out.modal = true;
  if (process.env.AI_GATEWAY_API_KEY) out.gateway = true;
  if (process.env.ANTHROPIC_API_KEY) out.direct = true;
  return out;
}

function resolveBackend(requested) {
  const detected = detectBackends();
  if (requested === 'auto') {
    if (detected.modal) return 'modal';
    if (detected.gateway) return 'gateway';
    if (detected.direct) return 'direct';
    throw new Error(
      'No LLM backend available. Set one of: MODAL_VLLM_URL, AI_GATEWAY_API_KEY, ANTHROPIC_API_KEY'
    );
  }
  if (!detected[requested]) {
    const envKey = requested === 'modal' ? 'MODAL_VLLM_URL' : requested === 'gateway' ? 'AI_GATEWAY_API_KEY' : 'ANTHROPIC_API_KEY';
    throw new Error(`Backend '${requested}' selected but ${envKey} is not set.`);
  }
  return requested;
}

// ── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(soul, contextChunks) {
  const base =
    `You are ${soul}, a coding/operator assistant inside the GAD framework.\n` +
    `Answer the operator's question concisely and directly.\n` +
    `If the question references an entity ID you don't know, say so and suggest \`gad decisions show <id>\` or \`gad snapshot --projectid <id>\` for ground truth.`;
  if (!contextChunks || contextChunks.length === 0) return base;
  const block = contextChunks
    .map((r, i) => `[${i + 1}] (${r.source ?? 'unknown'}) ${(r.snippet || r.text || '').slice(0, 400)}`)
    .join('\n\n');
  return base + '\n\nPrior context (retrieved from project index — use for grounding):\n' + block;
}

// ── Context-index retrieval ───────────────────────────────────────────────────

/**
 * Query the context-index for up to topK chunks relevant to `question`.
 * Returns [] on any error (context injection is best-effort).
 */
async function fetchContextChunks(question, { projectRoot, topK = 3 }) {
  try {
    const { query } = require('../../lib/context-index/index.cjs');
    return await query(question, { projectRoot, topK });
  } catch {
    return [];
  }
}

// ── Backend implementations ──────────────────────────────────────────────────

async function callModal({ url, question, soul, maxTokens, onToken, systemPrompt }) {
  const body = {
    model: process.env.MODAL_VLLM_MODEL || 'unknown',
    messages: [
      { role: 'system', content: systemPrompt ?? buildSystemPrompt(soul) },
      { role: 'user', content: question },
    ],
    max_tokens: maxTokens,
    stream: true,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.MODAL_VLLM_TOKEN ? { Authorization: `Bearer ${process.env.MODAL_VLLM_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Modal endpoint ${res.status}: ${await res.text()}`);
  let full = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t || !t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const obj = JSON.parse(payload);
        const delta = obj.choices?.[0]?.delta?.content || obj.choices?.[0]?.text || '';
        if (delta) {
          full += delta;
          onToken(delta);
        }
      } catch { /* skip malformed */ }
    }
  }
  return { text: full, model: body.model };
}

async function callViaAiSdk({ provider, modelString, question, soul, maxTokens, onToken, systemPrompt }) {
  // Lazy require: ai sdk isn't a hard dep of vendor/get-anything-done.
  // It resolves via the monorepo root node_modules at runtime.
  let streamText, modelFactory;
  try {
    ({ streamText } = require('ai'));
  } catch (err) {
    throw new Error(`AI SDK ('ai') not resolvable from this process. Install at monorepo root or run from a node_modules-reachable cwd. (${err.message})`);
  }
  let model;
  if (provider === 'gateway') {
    // AI SDK v6: pass the model string directly to streamText; gateway routes by AI_GATEWAY_API_KEY.
    model = modelString;
  } else if (provider === 'direct') {
    try {
      ({ anthropic: modelFactory } = require('@ai-sdk/anthropic'));
    } catch (err) {
      throw new Error(`@ai-sdk/anthropic not resolvable. Install at monorepo root. (${err.message})`);
    }
    model = modelFactory(modelString);
  } else {
    throw new Error(`callViaAiSdk: unknown provider ${provider}`);
  }
  const result = await streamText({
    model,
    system: systemPrompt ?? buildSystemPrompt(soul),
    prompt: question,
    maxOutputTokens: maxTokens,
  });
  let full = '';
  for await (const chunk of result.textStream) {
    full += chunk;
    onToken(chunk);
  }
  return { text: full, model: typeof modelString === 'string' ? modelString : 'unknown' };
}

// ── Main runner ──────────────────────────────────────────────────────────────

async function runAskLlm({ question: questionIn, backend, soul, json, maxTokens, noContext, projectRoot }) {
  let question = questionIn;
  const started = Date.now();
  let chosen, modelLabel;
  try {
    chosen = resolveBackend(backend);
  } catch (err) {
    if (json) {
      console.log(JSON.stringify({ backend: backend, model: null, text: '', durationMs: 0, error: err.message }));
    } else {
      process.stderr.write(`gad ask: ${err.message}\n`);
    }
    process.exit(1);
  }

  // ── Context-index injection (phase 245-07) ───────────────────────────────
  let contextChunks = [];
  if (!noContext) {
    const root = projectRoot || process.cwd();
    contextChunks = await fetchContextChunks(question, { projectRoot: root, topK: 3 });
  }
  const resolvedSystemPrompt = buildSystemPrompt(soul, contextChunks);

  // ── Token budget pre-send check ──────────────────────────────────────────
  {
    const systemPrompt = resolvedSystemPrompt;
    // Resolve model label early enough for budget lookup (use env or defaults)
    const modelForBudget = chosen === 'gateway'
      ? (process.env.GAD_ASK_GATEWAY_MODEL || 'anthropic/claude-sonnet-4-6')
      : chosen === 'direct'
        ? (process.env.GAD_ASK_DIRECT_MODEL || 'claude-sonnet-4-5')
        : (process.env.MODAL_VLLM_MODEL || 'default-small');
    const budget = budgetForModel(modelForBudget);
    const budgetResult = checkBudget({ system: systemPrompt, user: question }, budget);
    if (!budgetResult.withinBudget) {
      process.stderr.write(
        `gad ask: prompt is ${budgetResult.tokens} tokens — ${budgetResult.overBy} over budget (${budget}) for ${modelForBudget}. Truncating user prompt.\n`
      );
      question = truncateToBudget(question, budget - estimateTokens(systemPrompt), 'cl100k_base');
    }
  }

  let buffered = '';
  const onToken = (t) => {
    buffered += t;
    if (!json) process.stdout.write(t);
  };

  try {
    let result;
    if (chosen === 'modal') {
      result = await callModal({
        url: process.env.MODAL_VLLM_URL,
        question, soul, maxTokens, onToken,
        systemPrompt: resolvedSystemPrompt,
      });
      modelLabel = result.model;
    } else if (chosen === 'gateway') {
      modelLabel = process.env.GAD_ASK_GATEWAY_MODEL || 'anthropic/claude-sonnet-4-6';
      result = await callViaAiSdk({
        provider: 'gateway', modelString: modelLabel,
        question, soul, maxTokens, onToken,
        systemPrompt: resolvedSystemPrompt,
      });
    } else if (chosen === 'direct') {
      modelLabel = process.env.GAD_ASK_DIRECT_MODEL || 'claude-sonnet-4-5';
      result = await callViaAiSdk({
        provider: 'direct', modelString: modelLabel,
        question, soul, maxTokens, onToken,
        systemPrompt: resolvedSystemPrompt,
      });
    }
    if (!json) process.stdout.write('\n');
    const durationMs = Date.now() - started;
    if (json) {
      console.log(JSON.stringify({ backend: chosen, model: modelLabel, text: result.text, durationMs }));
    }
  } catch (err) {
    const durationMs = Date.now() - started;
    if (json) {
      console.log(JSON.stringify({ backend: chosen, model: modelLabel || null, text: buffered, durationMs, error: err.message }));
    } else {
      process.stderr.write(`\ngad ask: ${err.message}\n`);
    }
    process.exit(1);
  }
}

// ── Citty subcommand factory ─────────────────────────────────────────────────

function createAskLlmCommand(_deps) {
  return defineCommand({
    meta: {
      name: 'llm',
      description: 'Send a question to the best available LLM backend (auto: modal → gateway → direct). Streams to stdout. --json for tool-friendly output.',
    },
    args: {
      question: { type: 'positional', description: 'Question for the LLM', required: true },
      backend: { type: 'string', description: 'auto | modal | gateway | direct', default: 'auto' },
      soul: { type: 'string', description: 'Soul name for system framing', default: 'kael' },
      json: { type: 'boolean', description: 'Emit JSON {backend, model, text, durationMs, error?}', default: false },
      'max-tokens': { type: 'string', description: 'Max output tokens', default: '4096' },
      'no-context': { type: 'boolean', description: 'Skip context-index retrieval; use literal question only', default: false },
      projectid: { type: 'string', description: 'Project id for context-index root resolution', default: '' },
    },
    async run({ args }) {
      // Resolve project root for context-index lookup
      let projectRoot = process.cwd();
      if (args.projectid) {
        try {
          const { findRepoRoot } = require('../../lib/repo-root.cjs');
          const repoRoot = findRepoRoot(process.cwd());
          if (repoRoot) {
            // Try to get planning dir from config
            const gadConfig = require('../../lib/gad-config.cjs');
            const cfg = gadConfig.load(repoRoot);
            const projects = cfg.projects || [];
            const found = projects.find(p => p.id === args.projectid);
            if (found && found.planningDir) {
              projectRoot = path.resolve(repoRoot, path.dirname(found.planningDir));
            } else {
              projectRoot = repoRoot;
            }
          }
        } catch { /* best-effort */ }
      }
      await runAskLlm({
        question: String(args.question),
        backend: String(args.backend || 'auto'),
        soul: String(args.soul || 'kael'),
        json: !!args.json,
        maxTokens: parseInt(String(args['max-tokens'] || '4096'), 10) || 4096,
        noContext: !!args['no-context'],
        projectRoot,
      });
    },
  });
}

module.exports = { createAskLlmCommand, runAskLlm, resolveBackend, detectBackends };
