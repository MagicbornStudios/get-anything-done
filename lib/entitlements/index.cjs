'use strict';

const TIERS = Object.freeze(['community', 'pro', 'team']);

const FEATURE_REGISTRY = new Map();

function normalizeTier(planTier) {
  return typeof planTier === 'string' ? planTier.trim().toLowerCase() : '';
}

function normalizeFeatureId(featureId) {
  return typeof featureId === 'string' ? featureId.trim() : '';
}

function validateTierList(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new TypeError('tiers must be a non-empty array');
  }

  const normalized = [];
  for (const tier of tiers) {
    const value = normalizeTier(tier);
    if (!TIERS.includes(value)) {
      throw new RangeError(`Unknown tier: ${tier}`);
    }
    if (!normalized.includes(value)) {
      normalized.push(value);
    }
  }
  return normalized;
}

function registerFeature(id, tiers, description) {
  const featureId = normalizeFeatureId(id);
  if (!featureId) {
    throw new TypeError('feature id must be a non-empty string');
  }

  const allowedTiers = validateTierList(tiers);
  const featureDescription = String(description || '').trim();
  if (!featureDescription) {
    throw new TypeError('description must be a non-empty string');
  }

  const entry = { tiers: allowedTiers, description: featureDescription };
  FEATURE_REGISTRY.set(featureId, entry);
  return entry;
}

function check(featureId, planTier) {
  const feature = FEATURE_REGISTRY.get(normalizeFeatureId(featureId));
  if (!feature) return false;

  const tier = normalizeTier(planTier);
  if (!TIERS.includes(tier)) return false;

  return feature.tiers.includes(tier);
}

function listFeaturesForPlan(planTier) {
  const tier = normalizeTier(planTier);
  if (!TIERS.includes(tier)) return [];

  const features = [];
  for (const [id, feature] of FEATURE_REGISTRY.entries()) {
    if (feature.tiers.includes(tier)) {
      features.push({ id, description: feature.description });
    }
  }
  return features;
}

registerFeature('cloud-training', ['pro', 'team'], 'Train models in the cloud.');
registerFeature('hosted-rag', ['pro', 'team'], 'Hosted retrieval augmented generation.');
registerFeature('dataset-backup', ['pro', 'team'], 'Managed dataset backup and restore.');
registerFeature('savings-analytics', ['pro', 'team'], 'Usage and savings analytics dashboards.');
registerFeature('rented-compute', ['team'], 'Rented compute pools for shared workloads.');
registerFeature('multi-project', ['community', 'pro', 'team'], 'Manage multiple projects in one workspace.');

module.exports = {
  TIERS,
  FEATURE_REGISTRY,
  check,
  listFeaturesForPlan,
  registerFeature,
};
