'use strict';
/**
 * gad recall "<question>" — planning-grounded answer tool.
 *
 * Decision GLOBAL-D-450. Phase 284, task 284-04.
 *
 * Usage:
 *   gad recall "why did we rename knowledge to assistant" [--projectid global] [--k 6] [--json]
 *
 * Retrieves top-K planning artifacts (decisions, state-log, handoffs, notes,
 * tasks) relevant to the question, then feeds them as grounded context to
 * `gad ask llm` (via the runAskLlm export).  The LLM must cite artifact
 * ids; a Sources list is printed after the answer.
 *
 * Graceful degradation:
 *   - If the LLM backend is unavailable, prints retrieved sources so the
 *     human can read them directly.
 *   - If no artifacts are retrieved, says so without calling the LLM.
 */

const path = require('node:path');
const fs   = require('node:fs');
const { defineCommand } = require('citty');

function createRecallCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError } = deps;

  return defineCommand({
    meta: {
      name: 'recall',
      description:
        'Answer a planning question grounded in decisions, state-log, handoffs, notes, and tasks. Cites artifact ids. (D-450)',
    },
    args: {
      question: {
        type: 'positional',
        description: 'Natural-language question about planning history or rationale',
        required: true,
      },
      projectid: {
        type: 'string',
        description: 'Project id to resolve planning dirs from (default: auto-detect)',
        default: '',
      },
      k: {
        type: 'string',
        description: 'Max number of planning artifacts to retrieve (default: 6)',
        default: '6',
      },
      json: {
        type: 'boolean',
        description: 'Emit JSON { question, sources, answer, error? } instead of streaming',
        default: false,
      },
      sources: {
        type: 'boolean',
        description: 'Print retrieved sources only — skip the LLM call (alias: --sources-only)',
        default: false,
      },
      backend: {
        type: 'string',
        description: 'LLM backend override: auto | modal | gateway | direct',
        default: 'auto',
      },
    },

    async run({ args }) {
      const { retrieve, buildGroundedPrompt } = require('../../lib/recall/index.cjs');

      const question = String(args.question);
      const topK     = Math.max(1, parseInt(String(args.k || '6'), 10) || 6);
      const useJson  = !!args.json;
      const noLlm    = !!args['sources'];

      // ── Resolve planning dir ──────────────────────────────────────────────
      const baseDir = findRepoRoot();
      if (!baseDir) {
        if (useJson) {
          console.log(JSON.stringify({ question, sources: [], answer: '', error: 'Could not locate repo root.' }));
        } else {
          outputError('recall: could not locate repo root.');
        }
        process.exit(1);
        return;
      }

      let planningDir = path.join(baseDir, '.planning');
      try {
        const config = gadConfig.load(baseDir);
        const roots  = resolveRoots({ projectid: args.projectid || '' }, baseDir, config.roots);
        if (roots.length > 0) {
          const r = roots[0];
          const rootPath = path.isAbsolute(r.path) ? r.path : path.resolve(baseDir, r.path);
          planningDir = path.join(rootPath, r.planningDir || '.planning');
        }
      } catch { /* best-effort — use default */ }

      if (!fs.existsSync(planningDir)) {
        const msg = `recall: planning dir not found at ${planningDir}`;
        if (useJson) {
          console.log(JSON.stringify({ question, sources: [], answer: '', error: msg }));
        } else {
          process.stderr.write(msg + '\n');
        }
        process.exit(1);
        return;
      }

      // ── Retrieve ──────────────────────────────────────────────────────────
      let artifacts;
      try {
        artifacts = retrieve(question, { planningDir, topK });
      } catch (err) {
        const msg = `recall: retrieval error — ${err.message}`;
        if (useJson) {
          console.log(JSON.stringify({ question, sources: [], answer: '', error: msg }));
        } else {
          process.stderr.write(msg + '\n');
        }
        process.exit(1);
        return;
      }

      if (artifacts.length === 0) {
        const msg = 'No relevant planning artifacts found for this question.';
        if (useJson) {
          console.log(JSON.stringify({ question, sources: [], answer: msg }));
        } else {
          process.stdout.write(msg + '\n');
        }
        return;
      }

      // Build sources list (for display and graceful fallback)
      const sources = artifacts.map(a => ({ id: a.sourceId, type: a.type, path: a.path }));

      // ── No-LLM path ───────────────────────────────────────────────────────
      if (noLlm) {
        if (useJson) {
          console.log(JSON.stringify({ question, sources, answer: '(--no-llm: LLM call skipped)', groundedPrompt: buildGroundedPrompt(question, artifacts) }));
        } else {
          process.stdout.write('Retrieved planning artifacts:\n');
          for (const a of artifacts) {
            process.stdout.write(`  [${a.type}] ${a.sourceId}  (score: ${a.score.toFixed(2)})\n`);
            process.stdout.write(`    ${a.snippet.slice(0, 200).replace(/\n/g, ' ')}\n`);
          }
        }
        return;
      }

      // ── LLM call ──────────────────────────────────────────────────────────
      const groundedPrompt = buildGroundedPrompt(question, artifacts);

      let llmAnswer = '';
      let llmError  = null;

      try {
        const { runAskLlm } = require('./_ask-llm.cjs');
        if (useJson) {
          // Buffer the answer; print JSON at the end
          const result = await callBuffered({ runAskLlm, groundedPrompt, backend: String(args.backend || 'auto') });
          llmAnswer = result.text || '';
          if (result.error) llmError = result.error;
        } else {
          // Stream tokens directly then print Sources section
          await callStreaming({ runAskLlm, groundedPrompt, backend: String(args.backend || 'auto') });
        }
      } catch (err) {
        llmError = err.message;
      }

      // ── Output ────────────────────────────────────────────────────────────
      if (useJson) {
        console.log(JSON.stringify({ question, sources, answer: llmAnswer, error: llmError || undefined }));
        return;
      }

      // Streaming path already printed tokens; now print Sources footer
      if (llmError) {
        process.stderr.write(`\nLLM unavailable (${llmError}). Retrieved sources for manual review:\n`);
      } else {
        process.stdout.write('\n\nSources:\n');
      }
      for (const a of artifacts) {
        const rel = path.relative(baseDir, a.path).replace(/\\/g, '/');
        process.stdout.write(`  [${a.type}] ${a.id}  →  ${rel}\n`);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// LLM call helpers
// ---------------------------------------------------------------------------

/**
 * Call runAskLlm in buffered mode and return { text, error }.
 */
async function callBuffered({ runAskLlm, groundedPrompt, backend }) {
  return new Promise((resolve) => {
    let text = '';
    // runAskLlm writes to stdout; we can't easily capture it here without
    // monkey-patching.  Use the --json path instead: call it in a child
    // process when --json is desired.  For now, use the streaming internal
    // path and collect tokens via the internal onToken hook by calling the
    // function directly with a patched stdout.
    //
    // Simpler approach: just call runAskLlm normally. It will stream to
    // stdout; we mark it as json=true to get a final JSON line on stdout.
    // Capture by overriding process.stdout.write temporarily.
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk) => { text += chunk; return true; };
    runAskLlm({
      question: groundedPrompt,
      backend,
      soul: 'kael',
      json: true,
      maxTokens: 4096,
      noContext: true,   // context is already baked into the prompt
      projectRoot: process.cwd(),
    })
      .then(() => {
        process.stdout.write = origWrite;
        // text should be a JSON line
        try {
          const parsed = JSON.parse(text.trim());
          resolve({ text: parsed.text || '', error: parsed.error });
        } catch {
          resolve({ text: text.trim(), error: null });
        }
      })
      .catch((err) => {
        process.stdout.write = origWrite;
        resolve({ text: '', error: err.message });
      });
  });
}

/**
 * Call runAskLlm in streaming mode (tokens go directly to stdout).
 */
async function callStreaming({ runAskLlm, groundedPrompt, backend }) {
  await runAskLlm({
    question: groundedPrompt,
    backend,
    soul: 'kael',
    json: false,
    maxTokens: 4096,
    noContext: true,   // context is already baked into the grounded prompt
    projectRoot: process.cwd(),
  });
}

// ---------------------------------------------------------------------------
// Loader registration
// ---------------------------------------------------------------------------

module.exports = { createRecallCommand };
module.exports.register = (ctx) => {
  const cmd = createRecallCommand(ctx.common);
  return { recall: cmd };
};
