'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { render } = require('../../lib/table.cjs');
const { getSupabaseClient } = require('../../lib/supabase-client.cjs');

const BLOB_API_URL = 'https://blob.vercel-storage.com';
const SUPPORTED_ADAPTERS = new Set(['supabase-rest', 'vercel-blob', 'local-fs']);
const LOADED_ENV_ROOTS = new Set();

function resolveProjectRootById(deps, projectid) {
  if (!projectid) return null;
  const baseDir = deps.findRepoRoot ? deps.findRepoRoot() : process.cwd();
  const config = deps.gadConfig && typeof deps.gadConfig.load === 'function'
    ? deps.gadConfig.load(baseDir)
    : { roots: [] };
  const root = (config.roots || []).find((entry) => entry.id === projectid);
  if (!root) return null;
  return path.isAbsolute(root.path) ? root.path : path.resolve(baseDir, root.path);
}

function requireProjectRoot(deps, projectid, outputError) {
  if (!projectid) outputError('--projectid is required');
  const root = resolveProjectRootById(deps, projectid);
  if (!root) {
    outputError(`Unknown projectid: ${projectid}. Use \`gad projects list\` to see registered projects.`);
  }
  return root;
}

function loadEnvForRoot(repoRoot) {
  if (!repoRoot || LOADED_ENV_ROOTS.has(repoRoot)) return;
  LOADED_ENV_ROOTS.add(repoRoot);

  const envPath = path.join(repoRoot, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function ensureEnvLoaded(deps) {
  const repoRoot = deps.findRepoRoot ? deps.findRepoRoot() : process.cwd();
  loadEnvForRoot(repoRoot);
  return repoRoot;
}

function normalizeAdapter(adapter, outputError) {
  const normalized = String(adapter || 'supabase-rest').trim();
  if (!SUPPORTED_ADAPTERS.has(normalized)) {
    outputError(`Unsupported adapter: ${normalized}. Expected one of: ${Array.from(SUPPORTED_ADAPTERS).join(', ')}`);
  }
  return normalized;
}

function parseLimit(rawValue, fallback = 50) {
  const parsed = Number.parseInt(String(rawValue || fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizePathPart(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function buildBlobPath(bucket, key) {
  return [normalizePathPart(bucket), normalizePathPart(key)].filter(Boolean).join('/');
}

function ensureInsideRoot(root, targetPath, outputError) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(rootWithSep)) {
    outputError(`Path escapes project root: ${resolvedTarget}`);
  }
  return resolvedTarget;
}

function resolveLocalPath(projectRoot, bucket, key, outputError) {
  const base = ensureInsideRoot(projectRoot, path.resolve(projectRoot, bucket), outputError);
  if (!key) return base;
  return ensureInsideRoot(projectRoot, path.resolve(base, key), outputError);
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getFetchImpl(deps, outputError) {
  const impl = deps.fetchImpl || globalThis.fetch;
  if (typeof impl !== 'function') outputError('Fetch API is unavailable in this runtime.');
  return impl;
}

function getSupabaseAccessor(deps) {
  return deps.getSupabaseClient || getSupabaseClient;
}

function getVercelToken(deps, outputError) {
  ensureEnvLoaded(deps);
  const token = process.env.VERCEL_API_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    outputError('VERCEL_API_TOKEN not set in shell or .env.');
  }
  return token;
}

async function listSupabaseTables(client) {
  const query = client
    .schema('information_schema')
    .from('tables')
    .select('table_schema,table_name,table_type')
    .eq('table_schema', 'public')
    .order('table_name', { ascending: true });
  const { data, error } = await query;
  if (error) throw new Error(error.message || String(error));
  return Array.isArray(data) ? data : [];
}

async function listVercelBlobs(deps, bucket, limit, outputError) {
  const token = getVercelToken(deps, outputError);
  const fetchImpl = getFetchImpl(deps, outputError);
  const prefixBase = normalizePathPart(bucket);
  const url = new URL(BLOB_API_URL);
  url.searchParams.set('limit', String(limit));
  if (prefixBase) url.searchParams.set('prefix', `${prefixBase}/`);

  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await readResponseBody(response);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && payload.error && payload.error.message
      ? payload.error.message
      : `Vercel Blob list failed (${response.status})`;
    throw new Error(message);
  }
  return payload && Array.isArray(payload.blobs) ? payload.blobs : [];
}

async function getVercelBlob(deps, bucket, key, outputError) {
  const fullPath = buildBlobPath(bucket, key);
  const blobs = await listVercelBlobs(deps, fullPath, 20, outputError);
  const match = blobs.find((blob) => blob.pathname === fullPath);
  if (!match) throw new Error(`Blob not found: ${fullPath}`);

  const token = getVercelToken(deps, outputError);
  const fetchImpl = getFetchImpl(deps, outputError);
  const response = await fetchImpl(match.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Vercel Blob fetch failed (${response.status})`);
  }
  return response.text();
}

async function putVercelBlob(deps, bucket, key, value, outputError) {
  const token = getVercelToken(deps, outputError);
  const fetchImpl = getFetchImpl(deps, outputError);
  const fullPath = buildBlobPath(bucket, key);
  const response = await fetchImpl(`${BLOB_API_URL}/${fullPath}`, {
    method: 'PUT',
    body: value,
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-version': '6',
    },
  });
  const payload = await readResponseBody(response);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && payload.error && payload.error.message
      ? payload.error.message
      : `Vercel Blob put failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

function parseJsonObject(rawValue) {
  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch (err) {
    throw new Error(`Invalid JSON value: ${err.message || err}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Supabase put expects a JSON object value.');
  }
  return parsed;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printRows(rows, title) {
  if (!rows || rows.length === 0) {
    console.log('No rows found.');
    return;
  }
  console.log(render(rows, title ? { title } : {}));
}

function createDataCommand(deps) {
  const outputError = deps.outputError || ((message) => {
    throw new Error(message);
  });

  const tables = defineCommand({
    meta: { name: 'tables', description: 'List tables in the project database (Supabase)' },
    args: {
      projectid: { type: 'string', required: true, description: 'Project ID for context' },
      json: { type: 'boolean', description: 'Emit JSON', default: false },
    },
    async run({ args }) {
      try {
        ensureEnvLoaded(deps);
        requireProjectRoot(deps, args.projectid, outputError);
        const { client } = getSupabaseAccessor(deps)();
        const rows = await listSupabaseTables(client);
        if (args.json) {
          printJson(rows);
          return;
        }
        printRows(rows, `Supabase tables (${args.projectid})`);
      } catch (err) {
        outputError(err.message || String(err));
      }
    },
  });

  const list = defineCommand({
    meta: { name: 'list', description: 'List data objects' },
    args: {
      projectid: { type: 'string', required: true },
      bucket: { type: 'string', required: true, description: 'Table name, Blob prefix, or directory' },
      adapter: { type: 'string', description: 'supabase-rest, vercel-blob, local-fs', default: 'supabase-rest' },
      limit: { type: 'string', default: '50' },
      json: { type: 'boolean', default: false },
    },
    async run({ args }) {
      try {
        const adapter = normalizeAdapter(args.adapter, outputError);
        const limit = parseLimit(args.limit);

        if (adapter === 'supabase-rest') {
          ensureEnvLoaded(deps);
          requireProjectRoot(deps, args.projectid, outputError);
          const { client } = getSupabaseAccessor(deps)();
          const { data, error } = await client.from(args.bucket).select('*').limit(limit);
          if (error) throw new Error(error.message || String(error));
          if (args.json) {
            printJson(data || []);
            return;
          }
          printRows(data || [], `${args.bucket} (${args.projectid})`);
          return;
        }

        if (adapter === 'vercel-blob') {
          requireProjectRoot(deps, args.projectid, outputError);
          const blobs = await listVercelBlobs(deps, args.bucket, limit, outputError);
          if (args.json) {
            printJson(blobs);
            return;
          }
          printRows(
            blobs.map((blob) => ({
              pathname: blob.pathname,
              size: blob.size,
              uploadedAt: blob.uploadedAt || blob.uploaded_at || '',
              url: blob.url,
            })),
            `Vercel Blob (${args.bucket})`,
          );
          return;
        }

        const projectRoot = requireProjectRoot(deps, args.projectid, outputError);
        const dir = resolveLocalPath(projectRoot, args.bucket, '', outputError);
        if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`);
        const entries = fs.readdirSync(dir, { withFileTypes: true })
          .slice(0, limit)
          .map((entry) => ({
            name: entry.name,
            type: entry.isDirectory() ? 'dir' : 'file',
          }));
        if (args.json) {
          printJson(entries);
          return;
        }
        printRows(entries, `Local files (${args.bucket})`);
      } catch (err) {
        outputError(err.message || String(err));
      }
    },
  });

  const get = defineCommand({
    meta: { name: 'get', description: 'Retrieve a data object' },
    args: {
      projectid: { type: 'string', required: true },
      bucket: { type: 'string', required: true },
      key: { type: 'string', required: true, description: 'Row ID, blob path, or file path' },
      adapter: { type: 'string', default: 'supabase-rest' },
      json: { type: 'boolean', default: false },
      'id-column': { type: 'string', default: 'id', description: 'Column to match for Supabase row lookups' },
    },
    async run({ args }) {
      try {
        const adapter = normalizeAdapter(args.adapter, outputError);

        if (adapter === 'supabase-rest') {
          ensureEnvLoaded(deps);
          requireProjectRoot(deps, args.projectid, outputError);
          const { client } = getSupabaseAccessor(deps)();
          const { data, error } = await client
            .from(args.bucket)
            .select('*')
            .eq(args['id-column'], args.key)
            .single();
          if (error) throw new Error(error.message || String(error));
          if (args.json) {
            printJson(data);
            return;
          }
          printJson(data);
          return;
        }

        if (adapter === 'vercel-blob') {
          requireProjectRoot(deps, args.projectid, outputError);
          const content = await getVercelBlob(deps, args.bucket, args.key, outputError);
          console.log(content);
          return;
        }

        const projectRoot = requireProjectRoot(deps, args.projectid, outputError);
        const filePath = resolveLocalPath(projectRoot, args.bucket, args.key, outputError);
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        console.log(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        outputError(err.message || String(err));
      }
    },
  });

  const put = defineCommand({
    meta: { name: 'put', description: 'Store a data object' },
    args: {
      projectid: { type: 'string', required: true },
      bucket: { type: 'string', required: true },
      key: { type: 'string', required: true },
      value: { type: 'string', description: 'JSON value or file content' },
      adapter: { type: 'string', default: 'supabase-rest' },
      'id-column': { type: 'string', default: 'id', description: 'Column to populate for Supabase upserts' },
    },
    async run({ args }) {
      try {
        const adapter = normalizeAdapter(args.adapter, outputError);
        const value = typeof args.value === 'string' && args.value.length > 0
          ? args.value
          : fs.readFileSync(0, 'utf8');

        if (adapter === 'supabase-rest') {
          ensureEnvLoaded(deps);
          requireProjectRoot(deps, args.projectid, outputError);
          const { client } = getSupabaseAccessor(deps)();
          const payload = parseJsonObject(value);
          if (payload[args['id-column']] == null) payload[args['id-column']] = args.key;
          const { error } = await client.from(args.bucket).upsert(payload).select();
          if (error) throw new Error(error.message || String(error));
          console.log(`Stored row in ${args.bucket}:${args.key}`);
          return;
        }

        if (adapter === 'vercel-blob') {
          requireProjectRoot(deps, args.projectid, outputError);
          const blob = await putVercelBlob(deps, args.bucket, args.key, value, outputError);
          console.log(`Stored blob at ${blob && blob.url ? blob.url : buildBlobPath(args.bucket, args.key)}`);
          return;
        }

        const projectRoot = requireProjectRoot(deps, args.projectid, outputError);
        const filePath = resolveLocalPath(projectRoot, args.bucket, args.key, outputError);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, value);
        console.log(`Stored file at ${filePath}`);
      } catch (err) {
        outputError(err.message || String(err));
      }
    },
  });

  return defineCommand({
    meta: { name: 'data', description: 'Universal data access CLI (Supabase, Vercel Blob, Local FS)' },
    subCommands: { tables, list, get, put },
  });
}

module.exports = {
  createDataCommand,
  _internals: {
    resolveProjectRootById,
    loadEnvForRoot,
    buildBlobPath,
    resolveLocalPath,
    listSupabaseTables,
  },
};
module.exports.register = (ctx) => ({ data: createDataCommand(ctx.common) });
