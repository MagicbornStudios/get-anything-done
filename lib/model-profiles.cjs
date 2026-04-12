'use strict';

const AGENT_TIERS = {
  'gad-planner': 'opus',
  'gad-roadmapper': 'opus',
  'gad-executor': 'sonnet',
  'gad-phase-researcher': 'sonnet',
  'gad-project-researcher': 'sonnet',
  'gad-research-synthesizer': 'sonnet',
  'gad-debugger': 'opus',
  'gad-codebase-mapper': 'haiku',
  'gad-verifier': 'sonnet',
  'gad-plan-checker': 'sonnet',
  'gad-integration-checker': 'sonnet',
  'gad-nyquist-auditor': 'sonnet',
  'gad-advisor-researcher': 'opus',
  'gad-assumptions-analyzer': 'sonnet',
  'gad-doc-writer': 'sonnet',
  'gad-doc-verifier': 'sonnet',
  'gad-security-auditor': 'sonnet',
  'gad-ui-researcher': 'sonnet',
  'gad-ui-checker': 'sonnet',
  'gad-ui-auditor': 'sonnet',
  'gad-user-profiler': 'opus',
};

const VALID_PROFILES = ['off', 'inherit', 'quality', 'balanced', 'budget'];

const PROFILE_TIERS = {
  off: { opus: null, sonnet: null, haiku: null },
  inherit: { opus: 'inherit', sonnet: 'inherit', haiku: 'inherit' },
  quality: { opus: 'inherit', sonnet: 'inherit', haiku: 'sonnet' },
  balanced: { opus: 'inherit', sonnet: 'sonnet', haiku: 'haiku' },
  budget: { opus: 'sonnet', sonnet: 'haiku', haiku: 'haiku' },
};

const SDK_MODEL_IDS = {
  inherit: undefined,
  sonnet: 'sonnet',
  haiku: 'haiku',
  opus: 'opus',
};

const MODEL_PROFILES = Object.fromEntries(
  Object.entries(AGENT_TIERS).map(([agentType, tier]) => [
    agentType,
    Object.fromEntries(
      Object.entries(PROFILE_TIERS).map(([profile, tierMap]) => [
        profile,
        tierMap[tier],
      ])
    ),
  ])
);

function normalizeAgentType(agentType) {
  if (!agentType) return '';
  return String(agentType).trim().replace(/^gsd-/, 'gad-');
}

function normalizeProfile(profile) {
  const normalized = String(profile || 'off').trim().toLowerCase();
  return VALID_PROFILES.includes(normalized) ? normalized : normalized;
}

function normalizeOverride(value, target) {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim();
  const lower = normalized.toLowerCase();

  if (lower === 'off') return undefined;
  if (lower === 'inherit') return target === 'sdk' ? undefined : 'inherit';
  if (lower === 'opus') return target === 'sdk' ? SDK_MODEL_IDS.opus : 'inherit';
  if (lower === 'sonnet') return target === 'sdk' ? SDK_MODEL_IDS.sonnet : 'sonnet';
  if (lower === 'haiku') return target === 'sdk' ? SDK_MODEL_IDS.haiku : 'haiku';

  return normalized;
}

function resolveAgentModel(agentType, opts = {}) {
  const {
    profile = 'off',
    modelOverrides = {},
    target = 'claude',
  } = opts;

  const normalizedAgent = normalizeAgentType(agentType);
  const normalizedProfile = normalizeProfile(profile);

  if (modelOverrides && Object.prototype.hasOwnProperty.call(modelOverrides, normalizedAgent)) {
    return normalizeOverride(modelOverrides[normalizedAgent], target);
  }
  if (modelOverrides && Object.prototype.hasOwnProperty.call(modelOverrides, agentType)) {
    return normalizeOverride(modelOverrides[agentType], target);
  }

  const tier = AGENT_TIERS[normalizedAgent] || 'sonnet';
  const profileMap = PROFILE_TIERS[normalizedProfile] || PROFILE_TIERS.off;
  const alias = profileMap[tier];
  if (!alias) return undefined;

  if (target === 'sdk') {
    return SDK_MODEL_IDS[alias];
  }
  return alias;
}

function resolveWorkflowModels(config = {}, target = 'claude') {
  const profile = normalizeProfile(config.model_profile || 'off');
  const modelOverrides = config.model_overrides && typeof config.model_overrides === 'object'
    ? config.model_overrides
    : {};

  return {
    model_profile: profile,
    planner_model: resolveAgentModel('gad-planner', { profile, modelOverrides, target }),
    researcher_model: resolveAgentModel('gad-phase-researcher', { profile, modelOverrides, target }),
    checker_model: resolveAgentModel('gad-plan-checker', { profile, modelOverrides, target }),
    executor_model: resolveAgentModel('gad-executor', { profile, modelOverrides, target }),
    verifier_model: resolveAgentModel('gad-verifier', { profile, modelOverrides, target }),
    synthesizer_model: resolveAgentModel('gad-research-synthesizer', { profile, modelOverrides, target }),
    roadmapper_model: resolveAgentModel('gad-roadmapper', { profile, modelOverrides, target }),
    debugger_model: resolveAgentModel('gad-debugger', { profile, modelOverrides, target }),
    profiler_model: resolveAgentModel('gad-user-profiler', { profile, modelOverrides, target }),
  };
}

function getAgentToModelMapForProfile(profile) {
  const normalizedProfile = normalizeProfile(profile);
  const result = {};
  for (const agentType of Object.keys(MODEL_PROFILES)) {
    result[agentType] = MODEL_PROFILES[agentType][normalizedProfile];
  }
  return result;
}

function formatAgentToModelMapAsTable(agentToModelMap) {
  const keys = Object.keys(agentToModelMap);
  const values = Object.values(agentToModelMap).map(v => (v === undefined || v === null ? 'off' : String(v)));
  const agentWidth = Math.max('Agent'.length, ...(keys.length ? keys.map((a) => a.length) : [0]));
  const modelWidth = Math.max('Model'.length, ...(values.length ? values.map((m) => m.length) : [0]));
  const sep = '-'.repeat(agentWidth + 2) + '+' + '-'.repeat(modelWidth + 2);
  const header = ` ${'Agent'.padEnd(agentWidth)} | ${'Model'.padEnd(modelWidth)}`;
  let out = `${header}\n${sep}\n`;
  for (const [agent, model] of Object.entries(agentToModelMap)) {
    const printable = model === undefined || model === null ? 'off' : String(model);
    out += ` ${agent.padEnd(agentWidth)} | ${printable.padEnd(modelWidth)}\n`;
  }
  return out;
}

module.exports = {
  AGENT_TIERS,
  MODEL_PROFILES,
  PROFILE_TIERS,
  SDK_MODEL_IDS,
  VALID_PROFILES,
  formatAgentToModelMapAsTable,
  getAgentToModelMapForProfile,
  normalizeAgentType,
  normalizeProfile,
  resolveAgentModel,
  resolveWorkflowModels,
};
