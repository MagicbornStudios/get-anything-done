'use strict';
/**
 * gad nous — real-time search of Nous Research community signals.
 *
 * Subcommands:
 *   repos        — list NousResearch GitHub repos
 *   issues       — search issues/PRs across NousResearch org
 *   discussions  — list GitHub Discussions (falls back if auth needed)
 *   releases     — list recent releases across Nous repos
 *   activity     — aggregated N-day activity feed (issues + PRs + releases)
 *   search       — one-shot multi-target search
 *
 * Auth:
 *   GITHUB_TOKEN env var: 5000 req/hr with token, 60/hr without.
 *   With a fine-grained token that has read:discussion scope: full
 *   GraphQL discussions access.
 *
 * Settings keys:
 *   nous.github_org            (default "NousResearch")
 *   nous.cache_ttl_seconds     (default 300)
 *   nous.activity_default_days (default 7)
 *
 * Cache: .planning/.nous-cache/<hash>.json (TTL-gated)
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { defineCommand } = require('citty');

// ─── Constants ────────────────────────────────────────────────────────────────

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'gad-cli/1.35 (nous-research-feed)';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
}

function buildHeaders() {
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function cacheDir(repoRoot) {
  return path.join(repoRoot, '.planning', '.nous-cache');
}

function cacheKey(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

function readCache(dir, key, ttlSeconds) {
  const file = path.join(dir, `${key}.json`);
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const entry = JSON.parse(raw);
    const ageMs = Date.now() - entry.ts;
    if (ageMs < ttlSeconds * 1000) return entry.data;
  } catch (_) { /* miss */ }
  return null;
}

function writeCache(dir, key, data) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${key}.json`);
    fs.writeFileSync(file, JSON.stringify({ ts: Date.now(), data }, null, 2));
  } catch (_) { /* best-effort */ }
}

function parseRateLimit(headers) {
  // headers is a Headers object (native fetch) or plain object in tests
  const get = (k) => (typeof headers.get === 'function' ? headers.get(k) : headers[k]);
  const limit = get('x-ratelimit-limit');
  const remaining = get('x-ratelimit-remaining');
  const reset = get('x-ratelimit-reset');
  return {
    limit: limit ? parseInt(limit, 10) : null,
    remaining: remaining ? parseInt(remaining, 10) : null,
    resetAt: reset ? new Date(parseInt(reset, 10) * 1000).toISOString() : null,
    authenticated: Boolean(getToken()),
  };
}

/**
 * Fetch with cache + rate-limit surfacing.
 * Returns { data, rateLimit, cached }.
 */
async function apiFetch(url, { repoRoot, ttlSeconds = 300 } = {}) {
  const dir = repoRoot ? cacheDir(repoRoot) : null;
  const key = cacheKey(url);

  if (dir) {
    const cached = readCache(dir, key, ttlSeconds);
    if (cached !== null) return { data: cached, rateLimit: null, cached: true };
  }

  let res;
  try {
    res = await fetch(url, { headers: buildHeaders() });
  } catch (err) {
    throw new Error(`Network error fetching ${url}: ${err.message}`);
  }

  const rateLimit = parseRateLimit(res.headers);

  if (res.status === 403 || res.status === 429) {
    const reset = rateLimit.resetAt || '(unknown)';
    throw Object.assign(
      new Error(`GitHub rate limit hit (${res.status}). Resets at ${reset}. Set GITHUB_TOKEN for 5000 req/hr.`),
      { rateLimit, statusCode: res.status }
    );
  }

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch (_) {}
    throw Object.assign(
      new Error(`GitHub API error ${res.status} for ${url}: ${body.slice(0, 200)}`),
      { statusCode: res.status }
    );
  }

  const data = await res.json();
  if (dir) writeCache(dir, key, data);
  return { data, rateLimit, cached: false };
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchRepos(org, { limit = 30, repoRoot, ttlSeconds }) {
  const url = `${GITHUB_API}/orgs/${encodeURIComponent(org)}/repos?per_page=${Math.min(limit, 100)}&sort=pushed&type=public`;
  const { data, rateLimit, cached } = await apiFetch(url, { repoRoot, ttlSeconds });
  const repos = Array.isArray(data) ? data.slice(0, limit) : [];
  return {
    org,
    repos: repos.map((r) => ({
      name: r.name,
      full_name: r.full_name,
      description: r.description || '',
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language || null,
      topics: r.topics || [],
      pushed_at: r.pushed_at,
      html_url: r.html_url,
      archived: r.archived,
    })),
    metadata: { rateLimit, cached, url },
  };
}

async function fetchIssues(org, { query = '', repo = '', state = 'open', limit = 20, repoRoot, ttlSeconds }) {
  let q = `org:${org}`;
  if (repo) q += `+repo:${org}/${repo}`;
  if (query) q += `+${encodeURIComponent(query)}`;
  if (state !== 'all') q += `+state:${state}`;
  const url = `${GITHUB_API}/search/issues?q=${q}&per_page=${Math.min(limit, 100)}&sort=updated&order=desc`;
  const { data, rateLimit, cached } = await apiFetch(url, { repoRoot, ttlSeconds });
  const items = (data.items || []).slice(0, limit);
  return {
    total_count: data.total_count || 0,
    items: items.map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      repo: (i.repository_url || '').split('/').slice(-1)[0],
      author: i.user ? i.user.login : null,
      labels: (i.labels || []).map((l) => l.name),
      comments: i.comments,
      created_at: i.created_at,
      updated_at: i.updated_at,
      html_url: i.html_url,
      pull_request: Boolean(i.pull_request),
    })),
    metadata: { rateLimit, cached, query: q },
  };
}

async function fetchDiscussions(org, { query = '', repo = '', limit = 20, repoRoot, ttlSeconds }) {
  // GitHub REST discussions endpoint requires a specific repo, not org-wide.
  // Without a token for GraphQL, we surface issues tagged "discussion" as fallback.
  if (repo) {
    const url = `${GITHUB_API}/repos/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/discussions?per_page=${Math.min(limit, 100)}`;
    try {
      const { data, rateLimit, cached } = await apiFetch(url, { repoRoot, ttlSeconds });
      const items = Array.isArray(data) ? data.slice(0, limit) : [];
      return {
        source: 'discussions_api',
        items: items.map((d) => ({
          number: d.number,
          title: d.title,
          author: d.user ? d.user.login : null,
          category: d.category ? d.category.name : null,
          comments: d.comments,
          created_at: d.created_at,
          updated_at: d.updated_at,
          html_url: d.html_url,
        })),
        metadata: { rateLimit, cached },
      };
    } catch (err) {
      if (err.statusCode !== 404) throw err;
      // fall through to issue-label fallback
    }
  }

  // Org-wide fallback: search issues labeled "question" or "discussion"
  let q = `org:${org}+label:question`;
  if (query) q += `+${encodeURIComponent(query)}`;
  const url = `${GITHUB_API}/search/issues?q=${q}&per_page=${Math.min(limit, 100)}&sort=updated&order=desc`;
  const { data, rateLimit, cached } = await apiFetch(url, { repoRoot, ttlSeconds });
  const items = (data.items || []).slice(0, limit);
  return {
    source: 'issues_label_fallback',
    note: 'GraphQL token needed for full discussions. Showing issues labeled "question" instead.',
    items: items.map((i) => ({
      number: i.number,
      title: i.title,
      repo: (i.repository_url || '').split('/').slice(-1)[0],
      author: i.user ? i.user.login : null,
      labels: (i.labels || []).map((l) => l.name),
      comments: i.comments,
      created_at: i.created_at,
      updated_at: i.updated_at,
      html_url: i.html_url,
    })),
    metadata: { rateLimit, cached },
  };
}

async function fetchReleasesForRepo(org, repo, { limit = 10, repoRoot, ttlSeconds }) {
  const url = `${GITHUB_API}/repos/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/releases?per_page=${Math.min(limit, 100)}`;
  const { data, rateLimit, cached } = await apiFetch(url, { repoRoot, ttlSeconds });
  const items = Array.isArray(data) ? data.slice(0, limit) : [];
  return {
    repo,
    releases: items.map((r) => ({
      tag_name: r.tag_name,
      name: r.name || r.tag_name,
      draft: r.draft,
      prerelease: r.prerelease,
      author: r.author ? r.author.login : null,
      published_at: r.published_at,
      html_url: r.html_url,
      body_preview: r.body ? r.body.slice(0, 300) : '',
    })),
    metadata: { rateLimit, cached },
  };
}

async function fetchReleases(org, { repo = '', limit = 20, repoRoot, ttlSeconds }) {
  if (repo) {
    const result = await fetchReleasesForRepo(org, repo, { limit, repoRoot, ttlSeconds });
    return { releases: result.releases.map((r) => ({ ...r, repo })), metadata: result.metadata };
  }

  // Fetch top repos, then releases from each in parallel (up to 5 repos)
  const repoData = await fetchRepos(org, { limit: 20, repoRoot, ttlSeconds });
  const activeRepos = repoData.repos
    .filter((r) => !r.archived)
    .slice(0, 5);

  const results = await Promise.allSettled(
    activeRepos.map((r) => fetchReleasesForRepo(org, r.name, { limit: 5, repoRoot, ttlSeconds }))
  );

  const allReleases = [];
  let lastRateLimit = null;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      const repo = activeRepos[i].name;
      for (const rel of r.value.releases) allReleases.push({ ...rel, repo });
      lastRateLimit = r.value.metadata.rateLimit;
    }
  }

  allReleases.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  return {
    releases: allReleases.slice(0, limit),
    metadata: { rateLimit: lastRateLimit },
  };
}

async function fetchActivity(org, { days = 7, repoRoot, ttlSeconds }) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const q = `org:${org}+updated:>=${since.slice(0, 10)}`;
  const issueUrl = `${GITHUB_API}/search/issues?q=${q}+is:issue&per_page=30&sort=updated&order=desc`;
  const prUrl = `${GITHUB_API}/search/issues?q=${q}+is:pr&per_page=30&sort=updated&order=desc`;

  const [issuesResult, prsResult, releasesResult] = await Promise.allSettled([
    apiFetch(issueUrl, { repoRoot, ttlSeconds }),
    apiFetch(prUrl, { repoRoot, ttlSeconds }),
    fetchReleases(org, { limit: 20, repoRoot, ttlSeconds }),
  ]);

  const events = [];

  if (issuesResult.status === 'fulfilled') {
    for (const i of (issuesResult.value.data.items || [])) {
      events.push({
        type: 'issue',
        kind: i.state === 'closed' ? 'closed' : 'open',
        repo: (i.repository_url || '').split('/').slice(-1)[0],
        number: i.number,
        title: i.title,
        author: i.user ? i.user.login : null,
        url: i.html_url,
        updated_at: i.updated_at,
      });
    }
  }

  if (prsResult.status === 'fulfilled') {
    for (const p of (prsResult.value.data.items || [])) {
      events.push({
        type: 'pr',
        kind: p.state === 'closed' ? (p.pull_request && p.pull_request.merged_at ? 'merged' : 'closed') : 'open',
        repo: (p.repository_url || '').split('/').slice(-1)[0],
        number: p.number,
        title: p.title,
        author: p.user ? p.user.login : null,
        url: p.html_url,
        updated_at: p.updated_at,
      });
    }
  }

  if (releasesResult.status === 'fulfilled') {
    for (const r of releasesResult.value.releases) {
      if (r.published_at && r.published_at >= since) {
        events.push({
          type: 'release',
          kind: r.prerelease ? 'prerelease' : 'release',
          repo: r.repo,
          tag: r.tag_name,
          name: r.name,
          author: r.author,
          url: r.html_url,
          updated_at: r.published_at,
        });
      }
    }
  }

  events.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const rateLimit =
    (issuesResult.status === 'fulfilled' ? issuesResult.value.rateLimit : null) ||
    (prsResult.status === 'fulfilled' ? prsResult.value.rateLimit : null);

  return { org, days, since, events, metadata: { rateLimit } };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '?';
  return iso.slice(0, 10);
}

function printRepos(result) {
  console.log(`\nNous Research repos (${result.org}) — ${result.repos.length} returned\n`);
  const W = [30, 7, 7, 12, 11];
  const header = [
    'repo'.padEnd(W[0]),
    'stars'.padStart(W[1]),
    'forks'.padStart(W[2]),
    'language'.padEnd(W[3]),
    'pushed'.padEnd(W[4]),
  ].join('  ');
  console.log(header);
  console.log('─'.repeat(header.length));
  for (const r of result.repos) {
    const arc = r.archived ? ' [archived]' : '';
    const name = (r.name + arc).slice(0, W[0]).padEnd(W[0]);
    console.log([
      name,
      String(r.stars).padStart(W[1]),
      String(r.forks).padStart(W[2]),
      (r.language || '—').padEnd(W[3]),
      fmtDate(r.pushed_at).padEnd(W[4]),
    ].join('  '));
    if (r.description) console.log(`  ${r.description.slice(0, 100)}`);
  }
  printRateLimit(result.metadata.rateLimit);
}

function printIssues(result) {
  console.log(`\nNous Research issues — ${result.total_count} total, showing ${result.items.length}\n`);
  for (const i of result.items) {
    const type = i.pull_request ? 'PR' : 'issue';
    const labels = i.labels.length ? ` [${i.labels.join(', ')}]` : '';
    console.log(`  #${i.number} [${type}] [${i.state}] ${i.repo}${labels}`);
    console.log(`    ${i.title}`);
    console.log(`    by ${i.author || '?'} · updated ${fmtDate(i.updated_at)} · ${i.comments} comment(s)`);
    console.log(`    ${i.html_url}`);
    console.log();
  }
  printRateLimit(result.metadata.rateLimit);
}

function printDiscussions(result) {
  if (result.note) console.log(`\nNote: ${result.note}`);
  console.log(`\nDiscussions (source: ${result.source}) — ${result.items.length} returned\n`);
  for (const d of result.items) {
    const cat = d.category ? ` [${d.category}]` : '';
    console.log(`  #${d.number}${cat} ${d.repo || ''}`);
    console.log(`    ${d.title}`);
    console.log(`    by ${d.author || '?'} · updated ${fmtDate(d.updated_at)} · ${d.comments} comment(s)`);
    console.log(`    ${d.html_url}`);
    console.log();
  }
  printRateLimit(result.metadata.rateLimit);
}

function printReleases(result) {
  console.log(`\nNous Research releases — ${result.releases.length} returned\n`);
  for (const r of result.releases) {
    const flags = [r.prerelease ? 'pre' : null, r.draft ? 'draft' : null].filter(Boolean).join(',');
    console.log(`  ${r.repo} ${r.tag_name}${flags ? ` (${flags})` : ''} — ${fmtDate(r.published_at)}`);
    if (r.name && r.name !== r.tag_name) console.log(`    ${r.name}`);
    if (r.body_preview) console.log(`    ${r.body_preview.slice(0, 100).replace(/\n/g, ' ')}`);
    console.log(`    ${r.html_url}`);
    console.log();
  }
  printRateLimit(result.metadata.rateLimit);
}

function printActivity(result) {
  console.log(`\nNous Research activity — last ${result.days} days (since ${result.since.slice(0, 10)})\n`);
  console.log(`  ${result.events.length} events across issues, PRs, and releases\n`);
  for (const e of result.events) {
    const label = e.type === 'release' ? `${e.tag}` : `#${e.number}`;
    const repo = e.repo || '?';
    console.log(`  [${e.type.padEnd(7)}] [${e.kind.padEnd(9)}] ${repo}  ${label}`);
    console.log(`    ${e.title || e.name || ''}`);
    console.log(`    by ${e.author || '?'} · ${fmtDate(e.updated_at)}`);
    if (e.url) console.log(`    ${e.url}`);
    console.log();
  }
  printRateLimit(result.metadata.rateLimit);
}

function printRateLimit(rl) {
  if (!rl) return;
  const auth = rl.authenticated ? 'authenticated' : 'unauthenticated';
  const rem = rl.remaining !== null ? `${rl.remaining}/${rl.limit} remaining` : '';
  const reset = rl.resetAt ? ` · resets ${rl.resetAt.slice(11, 19)} UTC` : '';
  console.log(`\n  rate-limit: ${auth}${rem ? ` · ${rem}` : ''}${reset}`);
}

function outputResult(data, asJson) {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

function getNousSetting(gadConfig, key, defaultVal) {
  try {
    const cfg = gadConfig.load();
    const nous = (cfg && cfg.nous) || {};
    return nous[key] !== undefined ? nous[key] : defaultVal;
  } catch (_) {
    return defaultVal;
  }
}

// ─── Command factory ──────────────────────────────────────────────────────────

function createNousCommand(deps = {}) {
  const { findRepoRoot, gadConfig } = deps;

  function getOpts(args) {
    const org = args.org || getNousSetting(gadConfig, 'github_org', 'NousResearch');
    const ttl = parseInt(args['cache-ttl'] || getNousSetting(gadConfig, 'cache_ttl_seconds', 300), 10);
    let repoRoot = null;
    try {
      repoRoot = findRepoRoot ? findRepoRoot() : process.cwd();
    } catch (_) { repoRoot = process.cwd(); }
    return { org, ttlSeconds: ttl, repoRoot };
  }

  // ── gad nous repos ──────────────────────────────────────────────────────────
  const reposCmd = defineCommand({
    meta: { name: 'repos', description: 'List NousResearch GitHub repos with stars, language, last push' },
    args: {
      limit: { type: 'string', description: 'Max repos to return', default: '30' },
      json: { type: 'boolean', description: 'Output raw JSON', default: false },
      org: { type: 'string', description: 'GitHub org override', default: '' },
      'cache-ttl': { type: 'string', description: 'Cache TTL in seconds', default: '' },
    },
    async run({ args }) {
      const { org, ttlSeconds, repoRoot } = getOpts(args);
      const limit = parseInt(args.limit, 10) || 30;
      const result = await fetchRepos(org, { limit, repoRoot, ttlSeconds });
      if (args.json) return outputResult(result, true);
      printRepos(result);
    },
  });

  // ── gad nous issues ─────────────────────────────────────────────────────────
  const issuesCmd = defineCommand({
    meta: { name: 'issues', description: 'Search GitHub Issues across NousResearch org' },
    args: {
      query: { type: 'string', description: 'Search text', default: '' },
      repo: { type: 'string', description: 'Narrow to specific repo', default: '' },
      state: { type: 'string', description: 'open | closed | all', default: 'open' },
      limit: { type: 'string', description: 'Max results', default: '20' },
      json: { type: 'boolean', description: 'Output raw JSON', default: false },
      org: { type: 'string', description: 'GitHub org override', default: '' },
      'cache-ttl': { type: 'string', description: 'Cache TTL in seconds', default: '' },
    },
    async run({ args }) {
      const { org, ttlSeconds, repoRoot } = getOpts(args);
      const limit = parseInt(args.limit, 10) || 20;
      const result = await fetchIssues(org, { query: args.query, repo: args.repo, state: args.state || 'open', limit, repoRoot, ttlSeconds });
      if (args.json) return outputResult(result, true);
      printIssues(result);
    },
  });

  // ── gad nous discussions ────────────────────────────────────────────────────
  const discussionsCmd = defineCommand({
    meta: { name: 'discussions', description: 'List GitHub Discussions (falls back to issues if auth needed)' },
    args: {
      query: { type: 'string', description: 'Search text', default: '' },
      repo: { type: 'string', description: 'Specific repo name', default: '' },
      limit: { type: 'string', description: 'Max results', default: '20' },
      json: { type: 'boolean', description: 'Output raw JSON', default: false },
      org: { type: 'string', description: 'GitHub org override', default: '' },
      'cache-ttl': { type: 'string', description: 'Cache TTL in seconds', default: '' },
    },
    async run({ args }) {
      const { org, ttlSeconds, repoRoot } = getOpts(args);
      const limit = parseInt(args.limit, 10) || 20;
      const result = await fetchDiscussions(org, { query: args.query, repo: args.repo, limit, repoRoot, ttlSeconds });
      if (args.json) return outputResult(result, true);
      printDiscussions(result);
    },
  });

  // ── gad nous releases ───────────────────────────────────────────────────────
  const releasesCmd = defineCommand({
    meta: { name: 'releases', description: 'List recent releases across Nous Research repos' },
    args: {
      repo: { type: 'string', description: 'Specific repo name', default: '' },
      limit: { type: 'string', description: 'Max results', default: '20' },
      json: { type: 'boolean', description: 'Output raw JSON', default: false },
      org: { type: 'string', description: 'GitHub org override', default: '' },
      'cache-ttl': { type: 'string', description: 'Cache TTL in seconds', default: '' },
    },
    async run({ args }) {
      const { org, ttlSeconds, repoRoot } = getOpts(args);
      const limit = parseInt(args.limit, 10) || 20;
      const result = await fetchReleases(org, { repo: args.repo, limit, repoRoot, ttlSeconds });
      if (args.json) return outputResult(result, true);
      printReleases(result);
    },
  });

  // ── gad nous activity ───────────────────────────────────────────────────────
  const activityCmd = defineCommand({
    meta: { name: 'activity', description: 'Aggregated N-day activity feed (issues + PRs + releases)' },
    args: {
      days: { type: 'string', description: 'Number of days to look back', default: '' },
      json: { type: 'boolean', description: 'Output raw JSON', default: false },
      org: { type: 'string', description: 'GitHub org override', default: '' },
      'cache-ttl': { type: 'string', description: 'Cache TTL in seconds', default: '' },
    },
    async run({ args }) {
      const { org, ttlSeconds, repoRoot } = getOpts(args);
      const defaultDays = getNousSetting(gadConfig, 'activity_default_days', 7);
      const days = parseInt(args.days || defaultDays, 10) || 7;
      const result = await fetchActivity(org, { days, repoRoot, ttlSeconds });
      if (args.json) return outputResult(result, true);
      printActivity(result);
    },
  });

  // ── gad nous search ─────────────────────────────────────────────────────────
  const searchCmd = defineCommand({
    meta: { name: 'search', description: 'One-shot multi-target search across Nous Research signals' },
    args: {
      query: { type: 'positional', description: 'Search query', required: true },
      types: { type: 'string', description: 'Comma-separated: repos,issues,discussions,releases', default: 'issues,releases' },
      limit: { type: 'string', description: 'Max results per type', default: '10' },
      json: { type: 'boolean', description: 'Output raw JSON', default: false },
      org: { type: 'string', description: 'GitHub org override', default: '' },
      'cache-ttl': { type: 'string', description: 'Cache TTL in seconds', default: '' },
    },
    async run({ args }) {
      const { org, ttlSeconds, repoRoot } = getOpts(args);
      const limit = parseInt(args.limit, 10) || 10;
      const types = (args.types || 'issues,releases').split(',').map((t) => t.trim()).filter(Boolean);

      const tasks = {};
      if (types.includes('repos')) tasks.repos = fetchRepos(org, { limit, repoRoot, ttlSeconds });
      if (types.includes('issues')) tasks.issues = fetchIssues(org, { query: args.query, state: 'all', limit, repoRoot, ttlSeconds });
      if (types.includes('discussions')) tasks.discussions = fetchDiscussions(org, { query: args.query, limit, repoRoot, ttlSeconds });
      if (types.includes('releases')) tasks.releases = fetchReleases(org, { limit, repoRoot, ttlSeconds });

      const keys = Object.keys(tasks);
      const results = await Promise.allSettled(keys.map((k) => tasks[k]));
      const combined = {};
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const r = results[i];
        if (r.status === 'fulfilled') {
          combined[k] = r.value;
        } else {
          combined[k] = { error: r.reason.message };
        }
      }

      if (args.json) return outputResult({ query: args.query, org, types, results: combined }, true);

      console.log(`\nNous Research search: "${args.query}" (types: ${types.join(', ')})\n`);
      if (combined.repos && !combined.repos.error) {
        const repos = combined.repos.repos.filter((r) => r.name.toLowerCase().includes(args.query.toLowerCase()));
        if (repos.length) {
          console.log(`  Matching repos (${repos.length}):`);
          for (const r of repos) console.log(`    ${r.name}  ★${r.stars}  ${r.html_url}`);
          console.log();
        }
      }
      if (combined.issues && !combined.issues.error) printIssues(combined.issues);
      if (combined.discussions && !combined.discussions.error) printDiscussions(combined.discussions);
      if (combined.releases && !combined.releases.error) printReleases(combined.releases);
    },
  });

  return defineCommand({
    meta: { name: 'nous', description: 'Real-time search of Nous Research community signals (GitHub issues, releases, discussions)' },
    subCommands: {
      repos: reposCmd,
      issues: issuesCmd,
      discussions: discussionsCmd,
      releases: releasesCmd,
      activity: activityCmd,
      search: searchCmd,
    },
  });
}

module.exports = { createNousCommand, fetchRepos, fetchIssues, fetchDiscussions, fetchReleases, fetchActivity, apiFetch, parseRateLimit, cacheKey, readCache, writeCache };
module.exports.register = (ctx) => ({ nous: createNousCommand(ctx.common) });
