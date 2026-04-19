// argv injectors: backfill default subcommands on bare `gad <group>` so
// citty doesn't complain about missing positional. Also extracts the
// top-level --skill <slug> tagger (decision gad-178 / phase 42.3-16) into
// process.env.GAD_ACTIVE_SKILL.

/**
 * Inject a default subcommand into argv after `groupName` if none is
 * present. `known` lists subcommands that should be left alone. When
 * `injectOnUnknown` is true, an unrecognized positional gets the default
 * inserted before it (so `gad publish foo` becomes `gad publish set foo`).
 */
function injectDefault(groupName, defaultCmd, known, { injectOnUnknown = false } = {}) {
  const a = process.argv;
  const i = a.indexOf(groupName);
  if (i === -1) return;
  const first = a[i + 1];
  const knownSet = new Set(known);
  if (first === undefined || (typeof first === 'string' && first.startsWith('-'))) {
    a.splice(i + 1, 0, defaultCmd);
    return;
  }
  if (knownSet.has(first)) return;
  if (injectOnUnknown) a.splice(i + 1, 0, defaultCmd);
}

/** Apply every default-subcommand injector that gad.cjs needs. */
function applyDefaultSubcommandInjectors() {
  // gad query "text" routes to gad query run "text"
  (function injectQueryRunDefault() {
    const a = process.argv;
    const i = a.indexOf('query');
    if (i === -1) return;
    const first = a[i + 1];
    const known = new Set(['run', 'help']);
    if (first === undefined || (typeof first === 'string' && first.startsWith('-'))) {
      a.splice(i + 1, 0, 'run');
      return;
    }
    if (known.has(first)) return;
    a.splice(i + 1, 0, 'run');
  })();

  injectDefault('graph', 'build', ['build', 'stats', 'help']);

  // gad try <ref> routes to gad try stage <ref>; bare gad try → help
  (function injectTryStageDefault() {
    const a = process.argv;
    const i = a.indexOf('try');
    if (i === -1) return;
    const first = a[i + 1];
    const known = new Set(['stage', 'status', 'cleanup', 'help']);
    if (first === undefined) {
      a.splice(i + 1, 0, 'help');
      return;
    }
    if (known.has(first) || (typeof first === 'string' && first.startsWith('-'))) return;
    a.splice(i + 1, 0, 'stage');
  })();

  injectDefault('refs', 'list', ['list', 'verify', 'migrate', 'watch']);

  (function injectStateShowDefault() {
    const a = process.argv;
    const i = a.indexOf('state');
    if (i === -1) return;
    const first = a[i + 1];
    if (first === 'show' || first === 'set-next-action') return;
    if (first === undefined || (typeof first === 'string' && first.startsWith('-'))) {
      a.splice(i + 1, 0, 'show');
    }
  })();

  injectDefault('tasks', 'list', ['list', 'claim', 'release', 'active']);
  injectDefault('phases', 'list', ['list', 'add']);
  injectDefault('decisions', 'list', ['list', 'add']);
  injectDefault('todos', 'list', ['list', 'add']);

  // gad runtime defaults to select; some flags (--id/--same-shell/...) route to launch
  (function injectRuntimeSelectDefault() {
    const a = process.argv;
    const i = a.indexOf('runtime');
    if (i === -1) return;
    const first = a[i + 1];
    const known = new Set(['check', 'select', 'matrix', 'pipeline', 'launch', 'help']);
    if (first === undefined || (typeof first === 'string' && first.startsWith('-'))) {
      const launchFlag = String(first || '');
      const shouldDefaultToLaunch = launchFlag === '--id'
        || launchFlag.startsWith('--id=')
        || launchFlag === '--same-shell'
        || launchFlag === '--new-shell'
        || launchFlag === '--no-new-shell'
        || launchFlag === '--dry-run';
      a.splice(i + 1, 0, shouldDefaultToLaunch ? 'launch' : 'select');
      return;
    }
    if (known.has(first)) return;
  })();

  // gad publish: bare → list; positional projectid → set
  (function injectPublishDefault() {
    const a = process.argv;
    const i = a.indexOf('publish');
    if (i === -1) return;
    const first = a[i + 1];
    const known = new Set(['set', 'list', 'help']);
    if (first === undefined || (typeof first === 'string' && first.startsWith('-'))) {
      a.splice(i + 1, 0, 'list');
      return;
    }
    if (known.has(first)) return;
    a.splice(i + 1, 0, 'set');
  })();

  injectDefault('tip', 'today', ['today', 'random', 'search', 'list', 'categories', 'reindex', 'generate']);
}

/**
 * Strip top-level `--skill <slug>` (or `--skill=<slug>`) from argv and
 * stash the value into process.env.GAD_ACTIVE_SKILL so the trace hook
 * can stamp emitted tool_use events with `trigger_skill`.
 */
function extractActiveSkillFlag() {
  const a = process.argv;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--skill' && i + 1 < a.length) {
      process.env.GAD_ACTIVE_SKILL = a[i + 1];
      a.splice(i, 2);
      return;
    }
    const eq = a[i] && a[i].startsWith('--skill=') ? a[i].slice('--skill='.length) : null;
    if (eq) {
      process.env.GAD_ACTIVE_SKILL = eq;
      a.splice(i, 1);
      return;
    }
  }
}

module.exports = {
  applyDefaultSubcommandInjectors,
  extractActiveSkillFlag,
};
