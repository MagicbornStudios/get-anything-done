'use strict';

function getRuntimeArg(args, key, fallback = undefined) {
  if (!args || typeof args !== 'object') return fallback;
  const camel = String(key).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
  // citty can expose both dashed and camelized keys; prefer camelized values
  // because dashed keys may retain defaults even when CLI flags are provided.
  if (Object.prototype.hasOwnProperty.call(args, camel)) return args[camel];
  if (Object.prototype.hasOwnProperty.call(args, key)) return args[key];
  return fallback;
}

function parseCsvValues(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseRuntimeLaunchArgsText(rawValue) {
  const raw = String(rawValue || '');
  if (!raw.trim()) return [];
  const out = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current.length > 0) {
        out.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (quote) {
    throw new Error('Unterminated quote in --launch-args value.');
  }
  if (current.length > 0) out.push(current);
  return out;
}

function resolveRuntimeLaunchExtraArgs(args) {
  const jsonRaw = String(getRuntimeArg(args, 'launch-args-json', '') || '').trim();
  if (jsonRaw) {
    let parsed;
    try {
      parsed = JSON.parse(jsonRaw);
    } catch (err) {
      throw new Error(`Invalid --launch-args-json payload: ${err.message || err}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error('--launch-args-json must be a JSON array of strings.');
    }
    return parsed.map((entry) => String(entry));
  }
  const textRaw = String(getRuntimeArg(args, 'launch-args', '') || '').trim();
  if (!textRaw) return [];
  return parseRuntimeLaunchArgsText(textRaw);
}

module.exports = {
  getRuntimeArg,
  parseCsvValues,
  parseRuntimeLaunchArgsText,
  resolveRuntimeLaunchExtraArgs,
};
