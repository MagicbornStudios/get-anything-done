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

// ---------------------------------------------------------------------------
// Git-bash path-translation guard (Friction 2 fix — task 74-02)
//
// On Windows, git-bash (MSYS2) auto-translates arguments that start with /
// into Windows-style absolute paths.  For example:
//
//   --title "/boxes Catalog"   →   "C:/Program Files/Git/boxes Catalog"
//
// This is silent and almost always wrong for free-form string arguments.
// The fix: after citty has parsed argv, inspect every value for the flags
// below and emit a warning if the value matches a known MSYS2 drive-prefix
// pattern.  We do NOT silently un-mangle (risky if the value really is a
// Windows path).
//
// Flags covered: --title, --goal, --summary, --message, --rationale,
//                --body, --impact, --name, --description
//
// The check is heuristic: value starts with one of the known MSYS2 roots
// (C:/Program Files/Git/, C:/msys64/, etc.) that git-bash inserts when it
// translates a leading-slash string argument.
// ---------------------------------------------------------------------------

const GITBASH_MUNGE_PREFIXES = [
  'C:/Program Files/Git/',
  'C:/Program Files (x86)/Git/',
  'C:/msys64/',
  'C:/msys32/',
  'C:/cygwin64/',
  'C:/cygwin/',
  'D:/Program Files/Git/',
  'D:/msys64/',
];

const FREEFORM_STRING_FLAGS = new Set([
  '--title', '--goal', '--summary', '--message', '--rationale',
  '--body', '--impact', '--name', '--description',
]);

/**
 * Scan argv for freeform string flags whose values look like git-bash
 * path-translated leading-slash arguments.  Emits a warning to stderr for
 * each suspicious value but does NOT mutate or reject them (operator decides).
 *
 * Returns true if any suspicious values were found (callers may use this to
 * set a non-zero exit code if they choose).
 */
function warnGitBashMungedArgs(argv) {
  if (!argv) argv = process.argv;
  let warned = false;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    // Handle both --flag value and --flag=value forms.
    let flagName = null;
    let value = null;
    if (typeof token !== 'string') continue;
    if (token.includes('=')) {
      const eqIdx = token.indexOf('=');
      const candidate = token.slice(0, eqIdx);
      if (FREEFORM_STRING_FLAGS.has(candidate)) {
        flagName = candidate;
        value = token.slice(eqIdx + 1);
      }
    } else if (FREEFORM_STRING_FLAGS.has(token) && i + 1 < argv.length) {
      flagName = token;
      value = argv[i + 1];
    }
    if (flagName && typeof value === 'string') {
      const munged = GITBASH_MUNGE_PREFIXES.some((prefix) => value.startsWith(prefix));
      if (munged) {
        process.stderr.write(
          `gad: WARNING — argument ${flagName} value looks like git-bash path translation munged a leading slash:\n` +
          `  received: ${value}\n` +
          `  If your value was meant to start with "/" (e.g. "/boxes Catalog"), git-bash\n` +
          `  expanded it to a Windows path.  Workarounds:\n` +
          `    1. Use MSYS_NO_PATHCONV=1 before the command\n` +
          `    2. Double-slash the leading slash: "//boxes Catalog"\n` +
          `    3. Run via cmd.exe or PowerShell instead of git-bash\n` +
          `  The value was stored AS-IS; re-run with the corrected argument.\n`,
        );
        warned = true;
      }
    }
  }
  return warned;
}

module.exports = {
  applyDefaultSubcommandInjectors,
  extractActiveSkillFlag,
  warnGitBashMungedArgs,
};
