const RELEASE_SURFACE_PREFIXES = [
  '.github/workflows/release-',
  'bin/',
  'lib/',
  'agents/',
  'hooks/',
  'references/',
  'skills/',
  'templates/',
  'workflows/',
  'scripts/build-',
  'scripts/install-gad-',
  'scripts/release-',
  'scripts/sea-',
];

const RELEASE_SURFACE_EXACT = new Set([
  'CHANGELOG.md',
  'package.json',
  'package-lock.json',
]);

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

function isReleaseSurfacePath(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized) return false;
  if (RELEASE_SURFACE_EXACT.has(normalized)) return true;
  return RELEASE_SURFACE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

module.exports = {
  RELEASE_SURFACE_EXACT,
  RELEASE_SURFACE_PREFIXES,
  isReleaseSurfacePath,
  normalizePath,
};

