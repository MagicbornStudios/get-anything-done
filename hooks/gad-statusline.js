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
const LEVEL_SEGMENTS = 5;

// New compact render constants (used unless GAD_STATUSLINE_LEGACY=1)
const COMPACT_LEVEL_CELLS = 6;  // ▰▰▰▱▱▱ style, 6 cells
const COMPACT_CTX_CELLS = 5;    // █████ battery style, 5 cells

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

function computeLevelFromXp(totalXp) {
  let level = 1;
  let cumulative = 0;
  for (let i = 0; i < 99; i += 1) {
    const toNext = Math.ceil(100 * Math.pow(level, 1.5));
    if (cumulative + toNext > totalXp) {
      return { level, xpInLevel: totalXp - cumulative, xpToNext: toNext };
    }
    cumulative += toNext;
    level += 1;
  }
  return { level, xpInLevel: 0, xpToNext: 0 };
}

function readLevelSnapshot(projectContext) {
  if (!projectContext || !projectContext.rootPath) return null;
  const planningDir = path.join(projectContext.rootPath, '.planning');
  // Forward-compat: STATE.xml <level value=N xp=Y xp_to_next=Z/> per phase 126.
  try {
    const statePath = path.join(planningDir, 'STATE.xml');
    if (fs.existsSync(statePath)) {
      const content = fs.readFileSync(statePath, 'utf8');
      const m = content.match(/<level\s+[^>]*\bvalue="(\d+)"[^>]*\bxp="(\d+)"[^>]*\bxp_to_next="(\d+)"/);
      if (m) {
        return { level: Number(m[1]), xpInLevel: Number(m[2]), xpToNext: Number(m[3]) };
      }
    }
  } catch (e) {}
  // Bootstrap fallback: count done+stamped tasks as XP=1 each.
  try {
    const tasksDir = path.join(planningDir, 'tasks');
    if (!fs.existsSync(tasksDir)) return null;
    let xp = 0;
    for (const f of fs.readdirSync(tasksDir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const t = JSON.parse(fs.readFileSync(path.join(tasksDir, f), 'utf8'));
        if (t.status === 'done' && t.skill) xp += 1;
      } catch (e) {}
    }
    return computeLevelFromXp(xp);
  } catch (e) {
    return null;
  }
}

function renderLevelSegment(snapshot) {
  if (!snapshot) return '';
  const { level, xpInLevel, xpToNext } = snapshot;
  if (!xpToNext) return ` \x1b[35mLV ${level}\x1b[0m`;
  const ratio = Math.max(0, Math.min(1, xpInLevel / xpToNext));
  const filled = Math.round(ratio * LEVEL_SEGMENTS);
  const bar = '█'.repeat(filled) + '░'.repeat(LEVEL_SEGMENTS - filled);
  return ` \x1b[35mLV ${level} [${bar}] ${xpInLevel}/${xpToNext}\x1b[0m`;
}

function renderPressureSegment(snapshot) {
  if (!snapshot) return '';
  const score = Math.max(0, Math.min(1, Number(snapshot.score) || 0));
  const filled = Math.max(0, Math.min(PRESSURE_SEGMENTS, Math.round(score * PRESSURE_SEGMENTS)));
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(PRESSURE_SEGMENTS - filled);
  // Display as 0-100 integer (operator standing rule 2026-05-04).
  const score100 = Math.round(score * 100);
  const base = ` \u26A1 [${bar}] ${score100}`;

  // Color gradient with severity escalation (operator 2026-05-04:
  // 'changing colors based on how full of pressure it is').
  // Palette aligned with TUI gold/red identity.
  if (score100 >= 85) return ` \x1b[5;91m${base} EVOLVE NOW\x1b[0m`;
  if (score100 >= 70) return ` \x1b[1;91m${base} evo!\x1b[0m`;
  if (score100 >= 50) return ` \x1b[1;33m${base}\x1b[0m`;
  if (score100 >= 25) return ` \x1b[33m${base}\x1b[0m`;
  return ` \x1b[2;37m${base}\x1b[0m`;
}


// Compact variant: "LV2 ▰▰▰▱▱▱" — 6-cell fill bar, no XP numbers
function renderLevelSegmentCompact(snapshot) {
  if (!snapshot) return '';
  const { level, xpInLevel, xpToNext } = snapshot;
  if (!xpToNext) return ` \x1b[35mLV${level}\x1b[0m`;
  const ratio = Math.max(0, Math.min(1, xpInLevel / xpToNext));
  const filled = Math.round(ratio * COMPACT_LEVEL_CELLS);
  const bar = '\u25B0'.repeat(filled) + '\u25B1'.repeat(COMPACT_LEVEL_CELLS - filled);
  return ` \x1b[35mLV${level} ${bar}\x1b[0m`;
}

// Compact variant: single intensity glyph — P\u25e6 P\u25cb P\u25cf P! P!!
// No blink attribute — fixes Windows Terminal flicker (acceptance gate #2).
function renderPressureSegmentCompact(snapshot) {
  if (!snapshot) return '';
  const score = Math.max(0, Math.min(1, Number(snapshot.score) || 0));
  const score100 = Math.round(score * 100);

  if (score100 >= 85) return ` \x1b[1;91mP!!\x1b[0m`;  // bold-bright red, no blink
  if (score100 >= 70) return ` \x1b[1;91mP!\x1b[0m`;   // bold-bright red
  if (score100 >= 50) return ` \x1b[1;33mP\u25cf\x1b[0m`; // bold gold, filled circle
  if (score100 >= 25) return ` \x1b[33mP\u25cb\x1b[0m`;   // dim gold, open circle
  return ` \x1b[2;37mP\u25e6\x1b[0m`;                    // grey, bullet
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
  let usedForCtx = 0;
  if (remaining != null) {
    const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
    usedForCtx = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));

    if (session) {
      try {
        const bridgePath = require('path').join(require('os').tmpdir(), `claude-ctx-${session}.json`);
        const bridgeData = JSON.stringify({
          session_id: session,
          remaining_percentage: remaining,
          used_pct: usedForCtx,
          timestamp: Math.floor(Date.now() / 1000)
        });
        fs.writeFileSync(bridgePath, bridgeData);
      } catch (e) {
        // Silent fail -- bridge is best-effort, don't break statusline
      }
    }

    if (process.env.GAD_STATUSLINE_LEGACY === '1') {
      // ── LEGACY path: original 10-block bar + "% used" suffix ──────────
      const filled = Math.floor(usedForCtx / 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
      if (usedForCtx < 50) {
        ctx = ` \x1b[32m${bar} ${usedForCtx}%\x1b[0m`;
      } else if (usedForCtx < 65) {
        ctx = ` \x1b[33m${bar} ${usedForCtx}%\x1b[0m`;
      } else if (usedForCtx < 80) {
        ctx = ` \x1b[38;5;208m${bar} ${usedForCtx}%\x1b[0m`;
      } else {
        ctx = ` \x1b[5;31m\u{1F480} ${bar} ${usedForCtx}%\x1b[0m`;
      }
    } else {
      // ── COMPACT path: 5-cell battery glyph + number only ──────────────
      // ████░ 82% — no duplicate suffix, no skull blink
      const filledCells = Math.round((usedForCtx / 100) * COMPACT_CTX_CELLS);
      const bar = '\u2588'.repeat(filledCells) + '\u2591'.repeat(COMPACT_CTX_CELLS - filledCells);
      if (usedForCtx < 50) {
        ctx = ` \x1b[32m${bar} ${usedForCtx}%\x1b[0m`;
      } else if (usedForCtx < 65) {
        ctx = ` \x1b[33m${bar} ${usedForCtx}%\x1b[0m`;
      } else if (usedForCtx < 80) {
        ctx = ` \x1b[38;5;208m${bar} ${usedForCtx}%\x1b[0m`;
      } else {
        // bold-bright red, no blink (acceptance gate #2)
        ctx = ` \x1b[1;91m\u{1F480} ${bar} ${usedForCtx}%\x1b[0m`;
      }
    }
  }

  let task = '';
  const homeDir = require('os').homedir();
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || require('path').join(homeDir, '.claude');
  const todosDir = require('path').join(claudeDir, 'todos');
  if (session && fs.existsSync(todosDir)) {
    try {
      const files = fs.readdirSync(todosDir)
        .filter((file) => file.startsWith(session) && file.includes('-agent-') && file.endsWith('.json'))
        .map((file) => ({ name: file, mtime: fs.statSync(require('path').join(todosDir, file)).mtime }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > 0) {
        try {
          const todos = JSON.parse(fs.readFileSync(require('path').join(todosDir, files[0].name), 'utf8'));
          const inProgress = todos.find((todo) => todo.status === 'in_progress');
          if (inProgress) task = inProgress.activeForm || '';
        } catch (e) {}
      }
    } catch (e) {
      // Silently fail on file system errors - don't break statusline
    }
  }

  let gadUpdate = '';
  const sharedCacheFile = require('path').join(homeDir, '.cache', 'gad', 'gad-update-check.json');
  const legacyPrefix = ['g', 's', 'd'].join('');
  const legacyUpdateFile = `${legacyPrefix}-update-check.json`;
  const legacySharedCacheFile = require('path').join(homeDir, '.cache', legacyPrefix, legacyUpdateFile);
  const legacyRuntimeCacheFile = require('path').join(claudeDir, 'cache', legacyUpdateFile);
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

  let pressure, level;
  if (process.env.GAD_STATUSLINE_LEGACY === '1') {
    pressure = projectContext ? renderPressureSegment(readPressureSnapshot(projectContext.projectId, homeDir)) : '';
    level = projectContext ? renderLevelSegment(readLevelSnapshot(projectContext)) : '';
  } else {
    pressure = projectContext ? renderPressureSegmentCompact(readPressureSnapshot(projectContext.projectId, homeDir)) : '';
    level = projectContext ? renderLevelSegmentCompact(readLevelSnapshot(projectContext)) : '';
  }

  const dirname = require('path').basename(dir);
  if (task) {
    return `${gadUpdate}\x1b[2m${model}\x1b[0m \u2502 \x1b[1m${task}\x1b[0m \u2502 \x1b[2m${dirname}\x1b[0m${ctx}${pressure}${level}`;
  }
  return `${gadUpdate}\x1b[2m${model}\x1b[0m \u2502 \x1b[2m${dirname}\x1b[0m${ctx}${pressure}${level}`;
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
