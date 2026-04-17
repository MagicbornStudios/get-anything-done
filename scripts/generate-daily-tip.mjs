#!/usr/bin/env node
/**
 * generate-daily-tip.mjs — produce one teaching tip per day via OpenAI Responses API.
 *
 * Run by GitHub Actions (.github/workflows/daily-tip.yml) at 08:00 UTC:
 *   node vendor/get-anything-done/scripts/generate-daily-tip.mjs
 *
 * Env:
 *   OPENAI_API_KEY   required — stored as repo secret
 *   OPENAI_MODEL     optional — default gpt-4.1
 *   TIP_DATE         optional — YYYY-MM-DD, overrides today (for backfills)
 *
 * Output:
 *   - Writes teachings/generated/YYYY/MM/DD.md
 *   - Appends to teachings/index.json
 *
 * Cost: ~$0.002/tip at GPT-4.1 with web_search_preview. Under $1/year.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAD_DIR = path.resolve(__dirname, '..');
const TEACHINGS_DIR = path.join(GAD_DIR, 'teachings');
const INDEX_PATH = path.join(TEACHINGS_DIR, 'index.json');

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';
const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('OPENAI_API_KEY missing. Set it in env or GitHub secret.');
  process.exit(1);
}

const CATEGORIES = [
  { slug: 'llm-internals',         weight: 2, desc: 'How language models work under the hood — tokens, embeddings, attention, KV caching, training, sampling, quantization.' },
  { slug: 'context-engineering',   weight: 3, desc: 'Getting the right information into the model cheaply — prompt structure, caching, compaction, snapshot discipline, context budgets.' },
  { slug: 'coding-agents',         weight: 3, desc: 'Working with coding agents — Claude Code, Cursor, Codex, Aider, Cline, terminal-as-chat, agent-bring-your-own, skill triggering.' },
  { slug: 'gad-framework',         weight: 2, desc: 'GAD-specific patterns — pressure ontology, species/generations, gauges, workflows, phase loop, evaluation harness.' },
  { slug: 'craft',                 weight: 1, desc: 'Meta-skills — writing prompts, debugging an agent, when to restart a session, how to read a model\'s failure modes.' },
];

const today = process.env.TIP_DATE || isoDate();
const [Y, M, D] = today.split('-');

function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

function readIndex() {
  if (!fs.existsSync(INDEX_PATH)) return { schemaVersion: 1, tips: [] };
  return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
}

function pickCategory(index) {
  // Weight by (declared weight / (1 + tips in that category)) — prefers under-covered.
  const counts = new Map();
  for (const t of index.tips || []) counts.set(t.category, (counts.get(t.category) || 0) + 1);
  const weighted = CATEGORIES.map(c => {
    const penalty = 1 + (counts.get(c.slug) || 0);
    return { ...c, score: c.weight / penalty };
  });
  const total = weighted.reduce((s, c) => s + c.score, 0);
  let r = Math.random() * total;
  for (const c of weighted) {
    if (r < c.score) return c;
    r -= c.score;
  }
  return weighted[0];
}

function recentTitlesIn(index, category) {
  return (index.tips || [])
    .filter(t => t.category === category)
    .map(t => t.title);
}

function buildPrompt(category, recentTitles) {
  const avoid = recentTitles.length > 0
    ? `\n\nWe have already written tips with these titles (avoid re-covering):\n${recentTitles.map(t => `- ${t}`).join('\n')}`
    : '';

  return `You are writing a daily teaching tip for a developer-learning catalog in the GAD framework.

Category: **${category.slug}** — ${category.desc}

Pick ONE concrete, surprising, or load-bearing idea from this category. Write a self-contained teaching that a developer can read in 3-4 minutes and walk away with a concrete mental model or actionable technique.

Style:
- Start with a 2-5 word H1 title that IS the tip.
- Lead with ONE concrete sentence that IS the insight.
- Use tables for comparisons. Tables beat paragraphs for dense material.
- Short paragraphs. Concrete examples. No filler, no "in this tip we will".
- Include at least one concrete code / command / byte-count / number — specifics beat generalities.
- End with a one-sentence "## Takeaway" section.

Length: 300-500 words after the title line. Under 800 if you really need it.

Ground your claim in current real-world practice. If there is a specific recent paper, tool release, or engineering pattern that makes this tip timely (2025 or 2026), reference it. Use web search if needed to verify a claim.

## Backref footer (IMPORTANT)

If and only if you can point at a real file, command, decision, or phase that implements or motivates the idea — whether in the GAD framework, the llm-from-scratch project, or a well-known open-source reference — end the tip with a **## Where this lives in our stack** section. Use concrete repo paths like \`vendor/get-anything-done/lib/snapshot-compact.cjs\`, decision ids like \`gad-241\`, or phase references like \`llm-from-scratch:03\`. If you cannot honestly cite anything in this repo or a well-known external reference, omit the section — do not invent paths.

Output format (NO code fencing around the whole response, NO yaml frontmatter — we add that):

# <Title>

<body>${avoid}`;
}

async function callOpenAI(prompt) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      tools: [{ type: 'web_search_preview' }],
      input: prompt,
      max_output_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }
  const data = await res.json();

  // Extract the output_text from the Responses API structure.
  // Responses API returns { output: [ { type: "message", content: [{ type: "output_text", text: "..." }] } ] }
  if (data.output_text) return data.output_text;
  const text = (data.output || [])
    .flatMap(item => item.content || [])
    .filter(c => c.type === 'output_text' || c.type === 'text')
    .map(c => c.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('No text returned from OpenAI: ' + JSON.stringify(data).slice(0, 500));
  return text;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
}

function extractTitle(body) {
  const m = body.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : 'Untitled daily tip';
}

function buildFrontmatter({ id, title, category, tags, date }) {
  return [
    '---',
    `id: ${id}`,
    `title: ${title.replace(/"/g, '\\"')}`,
    `category: ${category}`,
    `difficulty: intermediate`,
    `tags: [${tags.map(t => t.replace(/[,\[\]]/g, '')).join(', ')}]`,
    `source: generated`,
    `date: ${date}`,
    '---',
    '',
  ].join('\n');
}

async function main() {
  const index = readIndex();

  const outDir = path.join(TEACHINGS_DIR, 'generated', Y, M);
  const outPath = path.join(outDir, `${D}.md`);
  if (fs.existsSync(outPath)) {
    console.log(`Already exists: ${path.relative(GAD_DIR, outPath)}`);
    return;
  }

  const category = pickCategory(index);
  const recent = recentTitlesIn(index, category.slug);
  const prompt = buildPrompt(category, recent);

  console.log(`Category: ${category.slug}`);
  console.log(`Model:    ${MODEL}`);
  console.log(`Calling OpenAI...`);

  const body = await callOpenAI(prompt);
  const title = extractTitle(body);
  const id = `${category.slug}-${slugify(title)}-${today}`;
  const tags = pickTagsFromBody(body).slice(0, 6);

  const frontmatter = buildFrontmatter({ id, title, category: category.slug, tags, date: today });
  const full = frontmatter + body.replace(/^#\s+.+\s*\n/, `# ${title}\n`);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, full);
  console.log(`Wrote ${path.relative(GAD_DIR, outPath)}`);

  // Append to index.json
  const relPath = path.relative(TEACHINGS_DIR, outPath).replace(/\\/g, '/');
  index.tips = index.tips || [];
  index.tips.push({
    id, title, category: category.slug,
    difficulty: 'intermediate',
    tags, source: 'generated', date: today,
    path: relPath,
  });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
  console.log(`Appended to index.json (${index.tips.length} total tips).`);
}

function pickTagsFromBody(body) {
  // Cheap heuristic — pick capitalized technical terms + common keywords.
  const keywords = new Set();
  const stop = new Set(['The','This','That','These','When','What','Why','How','Where','With','You','Your','And','But','For','From','Into','Our','Not','Are','Has','One','Two','Here','Use','Uses','Used','Take','Takeaway','Example','Most','Some','Only']);
  for (const m of body.matchAll(/\b([A-Z][a-z]+[A-Z][a-zA-Z]+|[A-Z]{2,})\b/g)) {
    if (!stop.has(m[1]) && m[1].length > 2) keywords.add(m[1].toLowerCase());
  }
  for (const m of body.matchAll(/`([a-zA-Z][\w-]{2,16})`/g)) {
    keywords.add(m[1].toLowerCase());
  }
  return [...keywords].slice(0, 8);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
