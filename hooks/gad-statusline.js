#!/usr/bin/env node
// gad-hook-version: {{GAD_VERSION}}
// Claude Code Statusline - GAD edition
// Shows: model | current task | directory | context usage | pressure

const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_CONFIG_FILES = [
  'gad-config.toml',
  path.join('.planning', 'gad-config.toml'),
  'planning-config.toml',
  path.join('.planning', 'planning-config.toml'),
];
const PRESSURE_CACHE_DIR = path.join('.cache', 'gad');
const PRESSURE_SEGMENTS = 5;

function stripTomlComment(line) {
  let inQuote = false;
  let quoteChar = '';
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if ((ch === '"' || ch === '\'') && line[i - 1] !== '\\') {
      if (!inQuote) {
        inQuote = true;
        quoteChar = ch;
      } else if (quoteChar === ch) {
        inQuote = false;
        quoteChar = '';
      }
    }
    if (ch === '#' && !inQuote) return line.slice(0, i);
  }
  return line;
}

function parseTomlScalar(raw) {
  const value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseProjectConfig(configPath) {
  try {
    const lines = fs.readFileSync(configPath, 'utf8').split(/\r?\n/);
    const parsed = { projectId: '', roots: [] };
    let section = '';
    let currentRoot = null;

    for (const rawLine of lines) {
      const line = stripTomlComment(rawLine).trim();
      if (!line) continue;

      const arrayMatch = line.match(/^\[\[(.+)\]\]$/);
      if (arrayMatch) {
        if (currentRoot) parsed.roots.push(currentRoot);
        section = arrayMatch[1].trim();
        currentRoot = section === 'planning.roots' ? {} : null;
        continue;
      }

      const sectionMatch = line.match(/^\[([^\[].+)\]$/);
      if (sectionMatch) {
        if (currentRoot) {
          parsed.roots.push(currentRoot);
          currentRoot = null;
        }
        section = sectionMatch[1].trim();
        continue;
      }

      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) continue;
      const key = line.slice(0, eqIndex).trim();
      const value = parseTomlScalar(line.slice(eqIndex + 1));

      if (section === 'project' && key === 'id') {
        parsed.projectId = String(value || '');
      } else if (section === 'planning.roots' && currentRoot) {
        currentRoot[key] = value;
      }
    }

    if (currentRoot) parsed.roots.push(currentRoot);
    return parsed;
  } catch (e) {
    return null;
  }
}

function isWithinDir(targetDir, candidateRoot) {
  const relative = path.relative(candidateRoot, targetDir);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function findConfigPath(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    for (const relPath of PROJECT_CONFIG_FILES) {
      const candidate = path.join(dir, relPath);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function findProjectContext(startDir) {
  const cwd = path.resolve(startDir);
  const configPath = findConfigPath(cwd);

  if (configPath) {
    const configRoot = configPath.includes(`${path.sep}.planning${path.sep}`)
      ? path.dirname(path.dirname(configPath))
      : path.dirname(configPath);
    const parsed = parseProjectConfig(configPath);

    if (parsed && Array.isArray(parsed.roots) && parsed.roots.length > 0) {
      const matches = parsed.roots
        .map((root) => {
          const rootPath = path.resolve(configRoot, String(root.path || '.'));
          const planningDir = String(root.planningDir || root.planning_dir || '.planning');
          return {
            projectId: String(root.id || ''),
            rootPath,
            exists: fs.existsSync(path.join(rootPath, planningDir)),
          };
        })
        .filter((entry) => entry.projectId && entry.exists && isWithinDir(cwd, entry.rootPath))
        .sort((a, b) => b.rootPath.length - a.rootPath.length);

      if (matches.length > 0) {
        return { projectId: matches[0].projectId, rootPath: matches[0].rootPath };
      }
    }

    if (parsed && parsed.projectId && fs.existsSync(path.join(configRoot, '.planning'))) {
      return { projectId: parsed.projectId, rootPath: configRoot };
    }
  }

  let dir = cwd;
  while (true) {
    if (fs.existsSync(path.join(dir, '.planning'))) {
      return { projectId: path.basename(dir), rootPath: dir };
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function getPressureCachePath(homeDir, projectId) {
  return path.join(homeDir, PRESSURE_CACHE_DIR, `pressure-${projectId}.json`);
}

function readPressureSnapshot(projectId, homeDir) {
  if (!projectId) return null;
  const fallback = {
    updated_at: null,
    projectid: projectId,
    score: 0,
    top_phase: 'placeholder',
    top_phase_score: 0,
  };
  const cachePath = getPressureCachePath(homeDir, projectId);
  if (!fs.existsSync(cachePath)) return fallback;

  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    return {
      updated_at: parsed.updated_at || null,
      projectid: parsed.projectid || projectId,
      score: Number.isFinite(parsed.score) ? parsed.score : 0,
      top_phase: parsed.top_phase || 'placeholder',
      top_phase_score: Number.isFinite(parsed.top_phase_score) ? parsed.top_phase_score : 0,
    };
  } catch (e) {
    return fallback;
  }
}

function renderPressureSegment(snapshot) {
  if (!snapshot) return '';
  const score = Math.max(0, Math.min(1, Number(snapshot.score) || 0));
  const filled = Math.max(0, Math.min(PRESSURE_SEGMENTS, Math.round(score * PRESSURE_SEGMENTS)));
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(PRESSURE_SEGMENTS - filled);
  const base = ` \u26A1 [${bar}] ${score.toFixed(2)}`;

  // Purple is the pressure-system identity color (distinct from gad-tui
  // gold/red palette which is reserved for action surfaces). Severity
  // is conveyed by fill density + brightness/blink, not hue change —
  // operators read severity from bar length, not from a color shift.
  if (score > 0.85) return ` \x1b[5;95m${base} EVOLVE NOW\x1b[0m`;
  if (score >= 0.7) return ` \x1b[1;95m${base} evo!\x1b[0m`;
  if (score >= 0.4) return ` \x1b[95m${base}\x1b[0m`;
  return ` \x1b[2;95m${base}\x1b[0m`;
}

function renderStatusline(data) {
  const model = data.model?.display_name || 'Claude';
  const dir = data.workspace?.current_dir || process.cwd();
  const session = data.session_id || '';
  const remaining = data.context_window?.remaining_percentage;

  // Context window display (shows USED percentage scaled to usable context)
  // Claude Code reserves ~16.5% for autocompact buffer, so usable context
  // is 83.5% of the total window. We normalize to show 100% at that point.
  const AUTO_COMPACT_BUFFER_PCT = 16.5;
  let ctx = '';
  if (remaining != null) {
    const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
    const used = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));

    if (session) {
      try {
        const bridgePath = path.join(os.tmpdir(), `claude-ctx-${session}.json`);
        const bridgeData = JSON.stringify({
          session_id: session,
          remaining_percentage: remaining,
          used_pct: used,
          timestamp: Math.floor(Date.now() / 1000)
        });
        fs.writeFileSync(bridgePath, bridgeData);
      } catch (e) {
        // Silent fail -- bridge is best-effort, don't break statusline
      }
    }

    const filled = Math.floor(used / 10);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);

    if (used < 50) {
      ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
    } else if (used < 65) {
      ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
    } else if (used < 80) {
      ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
    } else {
      ctx = ` \x1b[5;31m\u{1F480} ${bar} ${used}%\x1b[0m`;
    }
  }

  let task = '';
  const homeDir = os.homedir();
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude');
  const todosDir = path.join(claudeDir, 'todos');
  if (session && fs.existsSync(todosDir)) {
    try {
      const files = fs.readdirSync(todosDir)
        .filter((file) => file.startsWith(session) && file.includes('-agent-') && file.endsWith('.json'))
        .map((file) => ({ name: file, mtime: fs.statSync(path.join(todosDir, file)).mtime }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > 0) {
        try {
          const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
          const inProgress = todos.find((todo) => todo.status === 'in_progress');
          if (inProgress) task = inProgress.activeForm || '';
        } catch (e) {}
      }
    } catch (e) {
      // Silently fail on file system errors - don't break statusline
    }
  }

  let gadUpdate = '';
  const sharedCacheFile = path.join(homeDir, '.cache', 'gad', 'gad-update-check.json');
  const legacyPrefix = ['g', 's', 'd'].join('');
  const legacyUpdateFile = `${legacyPrefix}-update-check.json`;
  const legacySharedCacheFile = path.join(homeDir, '.cache', legacyPrefix, legacyUpdateFile);
  const legacyRuntimeCacheFile = path.join(claudeDir, 'cache', legacyUpdateFile);
  const cacheFile = fs.existsSync(sharedCacheFile)
    ? sharedCacheFile
    : (fs.existsSync(legacySharedCacheFile) ? legacySharedCacheFile : legacyRuntimeCacheFile);
  if (fs.existsSync(cacheFile)) {
    try {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cache.update_available) {
        gadUpdate = '\x1b[33m\u2B06 gad update\x1b[0m \u2502 ';
      }
      if (cache.stale_hooks && cache.stale_hooks.length > 0) {
        gadUpdate += '\x1b[31m\u26A0 stale hooks - run gad update\x1b[0m \u2502 ';
      }
    } catch (e) {}
  }

  // Pressure comes from a shared cache file so the statusline stays cheap.
  const projectContext = findProjectContext(dir);
  const pressure = projectContext ? renderPressureSegment(readPressureSnapshot(projectContext.projectId, homeDir)) : '';

  const dirname = path.basename(dir);
  if (task) {
    return `${gadUpdate}\x1b[2m${model}\x1b[0m \u2502 \x1b[1m${task}\x1b[0m \u2502 \x1b[2m${dirname}\x1b[0m${ctx}${pressure}`;
  }
  return `${gadUpdate}\x1b[2m${model}\x1b[0m \u2502 \x1b[2m${dirname}\x1b[0m${ctx}${pressure}`;
}

function main() {
  let input = '';
  const stdinTimeout = setTimeout(() => process.exit(0), 3000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  process.stdin.on('end', () => {
    clearTimeout(stdinTimeout);
    try {
      process.stdout.write(renderStatusline(JSON.parse(input)));
    } catch (e) {
      // Silent fail - don't break statusline on parse errors
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  findProjectContext,
  getPressureCachePath,
  parseProjectConfig,
  readPressureSnapshot,
  renderPressureSegment,
  renderStatusline,
};
