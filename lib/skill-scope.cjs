'use strict';

function normalizeList(value) {
  const raw = Array.isArray(value) ? value : (value ? [value] : []);
  return raw
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function dedupe(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function normalizeMap(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, entries] of Object.entries(value)) {
    const normalized = normalizeList(entries);
    if (normalized.length > 0) out[String(key || '').trim()] = normalized;
  }
  return out;
}

function normalizeSkillScope(rawScope) {
  const scope = rawScope && typeof rawScope === 'object' ? rawScope : {};
  return {
    enabled: scope.enabled !== false,
    default: normalizeList(scope.default),
    standing: normalizeList(scope.standing),
    standing_contexts: normalizeList(scope.standing_contexts).map((value) => value.toLowerCase()),
    runtime: normalizeMap(scope.runtime),
    context: Object.fromEntries(
      Object.entries(normalizeMap(scope.context)).map(([key, values]) => [key.toLowerCase(), values]),
    ),
  };
}

function resolveScopedSkills(scopeConfig, { runtime = '', context = '' } = {}) {
  const scope = normalizeSkillScope(scopeConfig);
  if (!scope.enabled) return [];
  const runtimeKey = String(runtime || '').trim();
  const contextKey = String(context || '').trim().toLowerCase();
  const standingApplies =
    scope.standing.length > 0 &&
    (scope.standing_contexts.length === 0 || scope.standing_contexts.includes(contextKey));
  return dedupe([
    ...scope.default,
    ...(standingApplies ? scope.standing : []),
    ...(runtimeKey && scope.runtime[runtimeKey] ? scope.runtime[runtimeKey] : []),
    ...(contextKey && scope.context[contextKey] ? scope.context[contextKey] : []),
  ]);
}

module.exports = {
  normalizeList,
  normalizeSkillScope,
  resolveScopedSkills,
};
