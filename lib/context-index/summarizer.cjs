'use strict';
/**
 * summarizer.cjs — group events by sessionId, call Ollama, write summaries
 *
 * Ollama endpoint: POST 127.0.0.1:11434/api/generate
 * Model preference: qwen2.5:3b, falls back to first installed model.
 * Skips session if summary already exists and events haven't changed.
 */

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const OLLAMA_URL = 'http://127.0.0.1:11434';
const PREFERRED_MODEL = 'qwen2.5:3b';

async function ollamaList() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return null;
    const data = await res.json();
    const models = (data.models || []).map(m => m.name);
    return models;
  } catch {
    return null;
  }
}

async function resolveModel() {
  const models = await ollamaList();
  if (!models || models.length === 0) return null;
  if (models.some(m => m.startsWith(PREFERRED_MODEL.split(':')[0]))) {
    return models.find(m => m.startsWith(PREFERRED_MODEL.split(':')[0]));
  }
  // pick smallest by name heuristic (prefer 3b/7b over larger)
  const small = models.find(m => /\d+b/.test(m) && parseInt(m.match(/(\d+)b/)[1]) <= 7);
  return small || models[0];
}

async function generateSummary(model, promptTemplate, eventsJson) {
  const prompt = promptTemplate.replace('{events_json}', eventsJson);
  const body = JSON.stringify({
    model,
    prompt,
    stream: false,
    options: { temperature: 0.3, num_predict: 600 },
  });

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`Ollama generate failed: ${res.status}`);
  const data = await res.json();
  return data.response || '';
}

function eventsHash(events) {
  const str = JSON.stringify(events.map(e => e.id + e.ts));
  return createHash('sha1').update(str).digest('hex').slice(0, 12);
}

/**
 * @param {Array} events  all ingested records with sessionId
 * @param {string} storeDir  .planning/context-index
 * @param {object} opts
 * @param {boolean} opts.force  re-generate even if summary exists
 * @returns {{written: string[], skipped: string[], error: string|null}}
 */
async function summarizeSessions(events, storeDir, opts = {}) {
  const summariesDir = path.join(storeDir, 'summaries');
  if (!fs.existsSync(summariesDir)) fs.mkdirSync(summariesDir, { recursive: true });

  const promptPath = path.join(__dirname, 'prompts', 'session-summary.txt');
  let promptTemplate = '';
  try { promptTemplate = fs.readFileSync(promptPath, 'utf8'); } catch {
    promptTemplate = 'Summarize these session events for a future agent:\n{events_json}';
  }

  // Group events by sessionId — skip null sessionIds
  const bySession = new Map();
  for (const ev of events) {
    if (!ev.sessionId) continue;
    if (!bySession.has(ev.sessionId)) bySession.set(ev.sessionId, []);
    bySession.get(ev.sessionId).push(ev);
  }

  if (bySession.size === 0) {
    return { written: [], skipped: [], error: null };
  }

  // Resolve Ollama model
  const model = await resolveModel();
  if (!model) {
    return {
      written: [], skipped: [],
      error: 'Ollama not reachable or no models installed — summaries skipped',
    };
  }

  const written = [];
  const skipped = [];

  for (const [sessionId, evList] of bySession) {
    const safeName = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const summaryPath = path.join(summariesDir, `${safeName}.md`);
    const hash = eventsHash(evList);

    // Check if existing summary covers same events
    if (!opts.force && fs.existsSync(summaryPath)) {
      const existing = fs.readFileSync(summaryPath, 'utf8');
      if (existing.includes(`events-hash:${hash}`)) {
        skipped.push(sessionId);
        continue;
      }
    }

    // Only include events with meaningful text; limit to 200 events
    const evSubset = evList.slice(0, 200).map(e => ({
      ts: e.ts, source: e.source, text: e.text.slice(0, 300),
    }));

    let summary;
    try {
      summary = await generateSummary(model, promptTemplate, JSON.stringify(evSubset, null, 2));
    } catch (err) {
      // Non-fatal — log and continue
      skipped.push(`${sessionId}:err=${err.message}`);
      continue;
    }

    const header = `<!-- session:${sessionId} events-hash:${hash} model:${model} generated:${new Date().toISOString()} -->\n\n`;
    fs.writeFileSync(summaryPath, header + summary, 'utf8');
    written.push(sessionId);
  }

  return { written, skipped, error: null };
}

module.exports = { summarizeSessions, resolveModel };
