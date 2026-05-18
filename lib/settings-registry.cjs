'use strict';
/**
 * settings-registry.cjs — canonical schema + resolution for gad settings.
 *
 * Precedence (first hit wins):
 *   1. process.env[envVar]  — coerced to declared type
 *   2. project gad-config.toml [settings] table
 *   3. user settings.toml  ($LOCALAPPDATA/gad/settings.toml on Windows,
 *                           $XDG_CONFIG_HOME/gad/settings.toml or
 *                           ~/.config/gad/settings.toml elsewhere)
 *   4. REGISTRY default
 *
 * No new dependencies — TOML read/write uses the tiny helpers in this file.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY = [
  {
    key: 'kael.dual_generate.enabled',
    type: 'boolean',
    default: true,
    envVar: 'VITE_KAEL_DUAL_GENERATE',
    scope: 'user',
    description: 'Whether Kael fires SLM + frontier in parallel per chat submit',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'kael.slm.enabled',
    type: 'boolean',
    default: false,
    envVar: 'VITE_KAEL_USE_SLM',
    scope: 'user',
    description: 'Whether the local SLM is active in the Kael stack',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'kael.slm.proxy_url',
    type: 'string|null',
    default: null,
    envVar: 'VITE_KAEL_SLM_PROXY_URL',
    scope: 'user',
    description: 'URL of the local SLM proxy (null = not configured)',
    validate: (v) => v === null || typeof v === 'string',
  },
  {
    key: 'kael.slm.health_probe_interval_ms',
    type: 'integer',
    default: 60000,
    scope: 'user',
    description: 'Interval in ms between SLM health probes',
    validate: (v) => Number.isInteger(v) && v > 0,
  },
  {
    key: 'team.worker.max_inner_rotations',
    type: 'integer',
    default: 3,
    scope: 'project',
    description: 'Max inner retry rotations inside a worker step before giving up',
    validate: (v) => Number.isInteger(v) && v >= 1,
  },
  {
    key: 'team.rate_limit.max_retries',
    type: 'integer',
    default: 3,
    scope: 'project',
    description: 'Max retry attempts on rate-limit before aborting a worker job',
    validate: (v) => Number.isInteger(v) && v >= 0,
  },
  {
    key: 'team.rate_limit.cooldown_ms',
    type: 'integer',
    default: 900000,
    scope: 'project',
    description: 'Cooldown wait in ms after a rate-limit hit (default 15 min)',
    validate: (v) => Number.isInteger(v) && v >= 0,
  },
  {
    key: 'handoffs.reclaim.stale_after_ms',
    type: 'integer',
    default: 21600000,
    scope: 'project',
    description: 'Age threshold in ms before a claimed handoff is reclaimed (default 6 h)',
    validate: (v) => Number.isInteger(v) && v > 0,
  },
  {
    key: 'handoffs.heartbeat.stale_after_ms',
    type: 'integer',
    default: 300000,
    scope: 'project',
    description: 'Age threshold in ms before a heartbeat is considered stale (default 5 min)',
    validate: (v) => Number.isInteger(v) && v > 0,
  },
  {
    key: 'team.status.alarm.stale_claim_after_s',
    type: 'integer',
    default: 21600,
    scope: 'project',
    description: 'Age threshold in seconds after which status alarm fires for a stale claim (default 6 h)',
    validate: (v) => Number.isInteger(v) && v > 0,
  },
  {
    key: 'feedback.askuserquestion.auto_record.enabled',
    type: 'boolean',
    default: false,
    scope: 'user',
    description: 'When true, AskUserQuestion answers in Claude Code auto-write to .planning/datasets/preference-pairs/<date>.jsonl via gad feedback record. Default OFF (opt-in) per operator standing rule 2026-05-09: features that capture data must be opt-in, never default-on.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'feedback.askuserquestion.daily_cap',
    type: 'integer',
    default: 20,
    scope: 'user',
    description: 'Maximum AskUserQuestion auto-record entries per day. Caps the operator-style training corpus growth rate; default 20 matches the operator-stated cadence of ~5 selections per 8h workday with headroom.',
    validate: (v) => Number.isInteger(v) && v >= 0,
  },
  {
    key: 'feedback.format_pick.weekly_rotation.enabled',
    type: 'boolean',
    default: true,
    scope: 'user',
    description: 'When true, the format-pick AskUserQuestion fires roughly weekly with a fresh content fragment so the option set does not stale. Operator standing rule 2026-05-09.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'domains.default_provider',
    type: 'string',
    default: 'ionos',
    scope: 'user',
    description: 'Default DNS provider for gad domains commands (ionos|cloudflare|route53|other)',
    validate: (v) => typeof v === 'string' && v.length > 0,
  },
  {
    key: 'domains.default_zone',
    type: 'string|null',
    default: null,
    envVar: 'GAD_DEFAULT_ZONE',
    scope: 'project',
    description: 'Default DNS zone for gad domains commands when --zone is omitted (e.g. magicbornstudios.com)',
    validate: (v) => v === null || typeof v === 'string',
  },
  {
    key: 'domains.ionos.api_endpoint',
    type: 'string',
    default: 'https://api.hosting.ionos.com/dns/v1',
    scope: 'user',
    description: 'IONOS Cloud DNS API base URL — override for staging/mock environments',
    validate: (v) => typeof v === 'string' && v.startsWith('http'),
  },
  {
    key: 'domains.auto_verify_after_apply',
    type: 'boolean',
    default: true,
    scope: 'user',
    description: 'When true, gad domains add --apply runs a DNS verification pass after provisioning',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'dev.kael.auto_launch.enabled',
    type: 'boolean',
    default: true,
    scope: 'user',
    description: 'When true, `gad dev` automatically launches Kael on invocation. Set false to suppress Kael launch (equivalent to --no-kael).',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'dev.consumer_web.auto_open_browser',
    type: 'boolean',
    default: true,
    scope: 'user',
    description: 'When true, `gad dev` opens consumer-web surface URLs in the system default browser after spawn. Set to false to suppress auto-open (or set GAD_DEV_NO_BROWSER=1).',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'dev.surfaces.parallel_launch',
    type: 'boolean',
    default: true,
    scope: 'project',
    description: 'When true, all surfaces are spawned in parallel (detached). When false, surfaces launch sequentially (each waited before next). Sequential mode is rarely needed.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'ecosystem.auto_up_on_session_start',
    type: 'boolean',
    default: false,
    scope: 'user',
    description: 'When true, the claude-code SessionStart hook fires `gad ecosystem up` in background so Kael + daemons come up alongside every session. Default OFF — opt-in.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'ecosystem.kael_required',
    type: 'boolean',
    default: true,
    scope: 'user',
    description: 'Whether `gad ecosystem up` must include Kael desktop. Set false to exclude Kael from auto-up.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'ecosystem.daemons_required',
    type: 'boolean',
    default: true,
    scope: 'user',
    description: 'Whether `gad ecosystem up` must include curator + delta-train daemons.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'ecosystem.team_required',
    type: 'boolean',
    default: false,
    scope: 'user',
    description: 'Whether `gad ecosystem up` should start the team dispatcher. Only useful when a team profile is configured.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'anomalies.detector_enabled',
    type: 'boolean',
    default: true,
    scope: 'user',
    description: 'Master switch for anomaly detection. When false, `gad anomalies list` and the ecosystem doctor anomaly section are skipped.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'anomalies.daily_premium_token_cap_usd',
    type: 'number',
    default: 50.0,
    scope: 'user',
    description: 'Hard daily token-spend cap in USD for premium runtimes (codex-cli, claude-code). Exceeding this triggers a critical anomaly.',
    validate: (v) => typeof v === 'number' && v > 0,
  },
  {
    key: 'anomalies.lookback_h_default',
    type: 'integer',
    default: 24,
    scope: 'project',
    description: 'Default lookback window in hours for anomaly detection queries.',
    validate: (v) => Number.isInteger(v) && v >= 1,
  },
  // ---------------------------------------------------------------------------
  // Bridge settings (2026-05-09 — operator: Discord / WhatsApp / SMS integrations)
  // ---------------------------------------------------------------------------
  {
    key: 'bridge.discord.default_webhook_url',
    type: 'string|null',
    default: null,
    envVar: 'DISCORD_WEBHOOK_URL',
    scope: 'user',
    description: 'Default Discord webhook URL for `gad bridge discord send` when no channel-specific URL is found. Opt-in: null means no outbound Discord traffic.',
    validate: (v) => v === null || (typeof v === 'string' && v.startsWith('http')),
  },
  {
    key: 'bridge.discord.kael_inbox_channel',
    type: 'string|null',
    default: null,
    scope: 'project',
    description: 'Name of the Discord channel (must be registered in gad-config.toml [bridge.discord.channels]) that pipes operator messages into Kael\'s chat thread.',
    validate: (v) => v === null || typeof v === 'string',
  },
  {
    key: 'bridge.whatsapp.provider',
    type: 'string',
    default: 'twilio',
    scope: 'user',
    description: 'WhatsApp provider: twilio (default) or meta (Meta WhatsApp Business Platform, requires business verification).',
    validate: (v) => ['twilio', 'meta'].includes(v),
  },
  {
    key: 'bridge.sms.provider',
    type: 'string',
    default: 'twilio',
    scope: 'user',
    description: 'SMS provider: twilio (the only supported provider currently).',
    validate: (v) => v === 'twilio',
  },
  {
    key: 'bridge.echo_kael_responses_to_inbox',
    type: 'boolean',
    default: false,
    scope: 'user',
    description: 'When true, every Kael response is mirrored back to the configured inbox channel (discord.kael_inbox_channel). Default OFF — opt-in per operator standing rule: premium-API features that multiply spend must be opt-in.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'workflow.subagent_commits_disabled_by_default',
    type: 'boolean',
    default: true,
    scope: 'user',
    description: 'When true, parallel subagents should NOT commit their own work; main thread stages + commits sequentially after wave returns. Prevents commit-race + --no-verify drift observed in multi-agent waves 2026-05-18. Per memory feedback_subagent_no_commit_workflow_setting.md.',
    validate: (v) => typeof v === 'boolean',
  },
  // ---------------------------------------------------------------------------
  // Risk-mode workflow settings (phase 252, 2026-05-18)
  // Opt-in speed/risk tradeoffs; all default to conservative values.
  // ---------------------------------------------------------------------------
  {
    key: 'workflow.subagent_parallelism_max',
    type: 'integer',
    default: 5,
    scope: 'user',
    description: 'Maximum concurrent subagents per wave. Raise to 8-10 for fast multi-file sweeps at the cost of higher token spend and more potential merge conflicts. Valid range: 1-15.',
    validate: (v) => Number.isInteger(v) && v >= 1 && v <= 15,
  },
  {
    key: 'workflow.subagent_typecheck_trust',
    type: 'boolean',
    default: false,
    scope: 'user',
    description: 'When true, skip the tsc verification subagent after a wave completes. Saves ~30s per wave; appropriate only for mechanical sweeps (renames, import-path fixes, boilerplate) where typing is known stable.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'workflow.task_stamp_batch',
    type: 'boolean',
    default: false,
    scope: 'user',
    description: 'When true, defer individual task stamps until end of agent wave rather than stamping inline. Reduces CLI round-trips per wave; risk: task registry partially blank if wave crashes mid-flight.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'workflow.cheap_model_for_mechanical',
    type: 'boolean',
    default: false,
    scope: 'user',
    description: 'When true, mechanical sweep subagents (renames, format passes, boilerplate generation) are routed to the cheap model tier for the active runtime (see .planning/runtimes/model-catalog.toml). Reduces token cost 5-10x for mechanical work; cheap models may miss nuance in boundary cases.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'workflow.risk_tolerance',
    type: 'string',
    default: 'low',
    scope: 'user',
    description: 'Composite risk level for workflow tradeoffs. Cosmetic/display value — individual settings remain authoritative. low=all risk settings off. medium=typecheck_trust+task_stamp_batch on. high=all four risk settings on + parallelism_max 10. Future: gad workflow risk set <level> will bulk-flip them.',
    validate: (v) => ['low', 'medium', 'high'].includes(v),
  },
  // ---------------------------------------------------------------------------
  // Terminal injection + overlay settings (phase 258, 2026-05-18)
  // ---------------------------------------------------------------------------
  {
    key: 'workflow.terminal_inject.allowed',
    type: 'boolean',
    default: false,
    scope: 'user',
    description: 'Allow the terminal_inject Tauri command to write payloads to PTY stdin. Default OFF — any subprocess that emits text could be intercepted/spoofed; operator must explicitly opt in. When true, Kael / chip-flow / scripts can paste prompts into running coding-agent CLI sessions.',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'workflow.terminal_overlay.trusted_tab_ids',
    type: 'array',
    default: [],
    scope: 'user',
    description: 'List of terminal tab IDs for which stdout tag parsing (GUI overlay middleware) is enabled. Use ["*"] to trust all tabs. Default empty (no tabs parse tags). Individual tabs can also be trusted via the tab-header trust toggle.',
    validate: (v) => Array.isArray(v) && v.every((x) => typeof x === 'string'),
  },
  // ---------------------------------------------------------------------------
  // Evolution workflow settings (phase 252, 2026-05-18)
  // ---------------------------------------------------------------------------
  {
    key: 'workflow.evolution.auto_on_levelup',
    type: 'boolean',
    default: true,
    scope: 'user',
    description: 'Trigger gad evolution evolve in background whenever level increases. Off = manual evolutions only.',
    validate: (v) => typeof v === 'boolean',
  },
  // ---------------------------------------------------------------------------
  // Desktop assistant identity (phase 259, 2026-05-18)
  // ---------------------------------------------------------------------------
  {
    key: 'desktop.assistant.name',
    type: 'string',
    default: 'Kael',
    scope: 'user',
    description: 'Display name for the desktop assistant. Used as the Knowledge sidebar label, panel header, and chat UI identity. Default: Kael.',
    validate: (v) => typeof v === 'string' && v.trim().length > 0,
  },
  // ---------------------------------------------------------------------------
  // Kael local model settings (phase 259, 2026-05-18)
  // ---------------------------------------------------------------------------
  {
    key: 'kael.model.id',
    type: 'string',
    default: 'qwen2.5:3b-instruct-q4_K_M',
    scope: 'user',
    description: 'Ollama model id for the local Kael SLM. MUST be a quantized variant (q4_K_M, q5_K_M, q8_0, etc.). Non-quantized pulls are rejected by the Ollama pull guard (phase 259-11).',
    validate: (v) => typeof v === 'string' && v.length > 0,
  },
  // ---------------------------------------------------------------------------
  // Phase 257 — chip-flow / worker routing settings (2026-05-18)
  // ---------------------------------------------------------------------------
  {
    key: 'kael.preferred_runtime',
    type: 'string',
    default: 'claude-code',
    scope: 'user',
    description: 'Standing worker runtime that receives chip-flow send-to-worker dispatches. pickWorker() prefers a worker whose runtime field matches this value. Accepted values: claude-code | codex-cli | gemini-cli | opencode | ollama.',
    validate: (v) => typeof v === 'string' && ['claude-code', 'codex-cli', 'gemini-cli', 'opencode', 'ollama'].includes(v),
  },
  {
    key: 'composer.chip_bar.auto_populate',
    type: 'boolean',
    default: true,
    scope: 'user',
    description: 'When true (default), Alt+click on any VCS-tagged element auto-pushes a chip into the chip bar. Set false to disable auto-populate (chips must be added manually).',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'composer.chip_bar.max_auto_chips',
    type: 'number',
    default: 10,
    scope: 'user',
    description: 'Maximum chips the auto-populate path may hold. When the cap is reached, the oldest chip is evicted to make room for the new one. Manual pushChip() calls are not capped.',
    validate: (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 50,
  },
  // ---------------------------------------------------------------------------
  // workflow.training — retraining pipeline thresholds (phase 253)
  // ---------------------------------------------------------------------------
  {
    key: 'workflow.training.llm_level_delta_min',
    type: 'integer',
    default: 2,
    scope: 'project',
    description: 'Min project level delta since last LLM train before retraining is triggered (phase 253)',
    validate: (v) => Number.isInteger(v) && v >= 1,
  },
  {
    key: 'workflow.training.dataset_delta_mb_min',
    type: 'integer',
    default: 500,
    scope: 'project',
    description: 'Min dataset growth in MB since last LLM/mid train before retraining is triggered (phase 253)',
    validate: (v) => Number.isInteger(v) && v >= 1,
  },
  {
    key: 'workflow.training.knn_dpo_delta_min',
    type: 'integer',
    default: 100,
    scope: 'project',
    description: 'Min new DPO pairs in .planning/datasets/dpo/ since last kNN/intent train before retraining is triggered (phase 253)',
    validate: (v) => Number.isInteger(v) && v >= 1,
  },
  {
    key: 'workflow.training.min_elo_improvement',
    type: 'integer',
    default: 10,
    scope: 'project',
    description: 'Min ELO improvement a candidate model must show over the current active model to pass the bench gate (phase 253)',
    validate: (v) => Number.isInteger(v) && v >= 0,
  },
  {
    key: 'training.hf_archive_repo',
    type: 'string|null',
    default: null,
    envVar: 'GAD_HF_ARCHIVE_REPO',
    scope: 'user',
    description: 'HuggingFace repo slug (org/repo) for archiving displaced models. null = local archive only (phase 253)',
    validate: (v) => v === null || (typeof v === 'string' && v.length > 0),
  },
];

// ---------------------------------------------------------------------------
// TOML helpers (minimal, covers flat [section] tables only)
// ---------------------------------------------------------------------------

/**
 * Parse a TOML file returning { sections: Map<string, Map<string, string>> }
 * where the top-level (before any header) is section ''.
 * Only supports scalar values and simple quoted/unquoted strings; sufficient
 * for the flat [settings] table we write.
 */
function parseTomlSections(text) {
  const sections = new Map();
  sections.set('', new Map());
  let current = '';
  const rawLines = text.split(/\r?\n/);
  for (const line of rawLines) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith('#')) continue;
    const headerMatch = stripped.match(/^\[([^\]]+)\]$/);
    if (headerMatch) {
      current = headerMatch[1].trim();
      if (!sections.has(current)) sections.set(current, new Map());
      continue;
    }
    const eqIdx = stripped.indexOf('=');
    if (eqIdx === -1) continue;
    const k = stripped.slice(0, eqIdx).trim();
    const rawV = stripped.slice(eqIdx + 1).trim();
    sections.get(current).set(k, rawV);
  }
  return sections;
}

function parseTomlScalar(rawV) {
  if (rawV === 'true') return true;
  if (rawV === 'false') return false;
  if (rawV === 'null') return null;
  const dq = rawV.match(/^"(.*)"$/s);
  if (dq) return dq[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const sq = rawV.match(/^'(.*)'$/s);
  if (sq) return sq[1];
  const num = Number(rawV);
  if (!isNaN(num) && rawV !== '') return num;
  return rawV;
}

function tomlScalarSerialize(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    return `"${escaped}"`;
  }
  return `"${String(v)}"`;
}

/**
 * Read a TOML file and return the value at [section][key], or undefined.
 * Returns the JS-typed value (boolean, number, string, null).
 */
function readTomlKey(filePath, section, key) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return undefined;
    throw e;
  }
  const sections = parseTomlSections(text);
  const sec = sections.get(section);
  if (!sec) return undefined;
  const rawV = sec.get(key);
  if (rawV === undefined) return undefined;
  return parseTomlScalar(rawV);
}

/**
 * Write (or remove when value===UNSET_SENTINEL) a single key in [section]
 * of a TOML file.  Preserves all other sections and comments line-by-line.
 * Creates the file + parent dirs if absent.
 */
const UNSET_SENTINEL = Symbol('UNSET');

function writeTomlKey(filePath, section, key, value) {
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }

  const lines = text.split(/\r?\n/);
  // Remove trailing empty line artifact from split
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  let inTargetSection = false;
  let sectionFound = false;
  let keyWritten = false;
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    const headerMatch = stripped.match(/^\[([^\]]+)\]$/);
    if (headerMatch) {
      const hdr = headerMatch[1].trim();
      if (inTargetSection && !keyWritten && value !== UNSET_SENTINEL) {
        // Insert key before we leave the section
        out.push(`${key} = ${tomlScalarSerialize(value)}`);
        keyWritten = true;
      }
      inTargetSection = hdr === section;
      if (inTargetSection) sectionFound = true;
      out.push(lines[i]);
      continue;
    }
    if (inTargetSection) {
      const eqIdx = stripped.indexOf('=');
      if (eqIdx !== -1) {
        const k = stripped.slice(0, eqIdx).trim();
        if (k === key) {
          if (value === UNSET_SENTINEL) {
            // Drop the line (unset)
            continue;
          }
          out.push(`${key} = ${tomlScalarSerialize(value)}`);
          keyWritten = true;
          continue;
        }
      }
    }
    out.push(lines[i]);
  }

  if (!sectionFound && value !== UNSET_SENTINEL) {
    out.push('');
    out.push(`[${section}]`);
    out.push(`${key} = ${tomlScalarSerialize(value)}`);
    keyWritten = true;
  } else if (inTargetSection && !keyWritten && value !== UNSET_SENTINEL) {
    out.push(`${key} = ${tomlScalarSerialize(value)}`);
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, out.join('\n') + '\n', 'utf8');
  fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function userSettingsTomlPath() {
  const env = process.env;
  if (env.GAD_USER_SETTINGS_TOML) return env.GAD_USER_SETTINGS_TOML;
  if (process.platform === 'win32') {
    const base = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'gad', 'settings.toml');
  }
  const xdg = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, 'gad', 'settings.toml');
}

function projectTomlPath(opts = {}) {
  if (opts.projectTomlPath) return opts.projectTomlPath;
  // Try to locate gad-config.toml walking up from cwd or baseDir
  const startDir = opts.baseDir || process.cwd();
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'gad-config.toml');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Type coercion
// ---------------------------------------------------------------------------

function coerce(type, raw) {
  if (raw === undefined || raw === null) return raw;
  if (type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    return undefined; // uncoerceable
  }
  if (type === 'integer') {
    const n = parseInt(String(raw), 10);
    return isNaN(n) ? undefined : n;
  }
  if (type === 'string|null') {
    if (raw === 'null' || raw === '') return null;
    return String(raw);
  }
  if (type === 'string') return String(raw);
  return raw;
}

// ---------------------------------------------------------------------------
// Core resolution
// ---------------------------------------------------------------------------

function findEntry(key) {
  return REGISTRY.find((e) => e.key === key);
}

/**
 * Resolve where a setting's current value comes from.
 * Returns { source: 'env'|'project'|'user'|'default', value }
 */
function resolveSettingSource(key, opts = {}) {
  const entry = findEntry(key);
  if (!entry) return { source: 'default', value: undefined };

  // 1. env
  if (entry.envVar) {
    const raw = process.env[entry.envVar];
    if (raw !== undefined) {
      const coerced = coerce(entry.type, raw);
      if (coerced !== undefined) return { source: 'env', value: coerced };
    }
  }

  // 2. project gad-config.toml [settings]
  const projPath = projectTomlPath(opts);
  if (projPath) {
    const v = readTomlKey(projPath, 'settings', key);
    if (v !== undefined) return { source: 'project', value: coerce(entry.type, v) };
  }

  // 3. user settings.toml
  const userPath = opts.userTomlPath || userSettingsTomlPath();
  const uv = readTomlKey(userPath, 'settings', key);
  if (uv !== undefined) return { source: 'user', value: coerce(entry.type, uv) };

  // 4. default
  return { source: 'default', value: entry.default };
}

/**
 * Get the effective value of a setting.
 * @param {string} key
 * @param {*} [fallbackDefault] — overrides REGISTRY default if provided
 * @param {object} [opts]
 */
function getSetting(key, fallbackDefault, opts = {}) {
  const { source, value } = resolveSettingSource(key, opts);
  if (source === 'default') {
    const entry = findEntry(key);
    if (!entry) return fallbackDefault !== undefined ? fallbackDefault : undefined;
    return fallbackDefault !== undefined ? fallbackDefault : entry.default;
  }
  return value;
}

/**
 * Validate a value against the registry entry.
 * Returns { valid: true } or { valid: false, reason: string }
 */
function validateSetting(key, value) {
  const entry = findEntry(key);
  if (!entry) return { valid: false, reason: `Unknown setting key: ${key}` };
  if (typeof entry.validate === 'function') {
    if (!entry.validate(value)) {
      return { valid: false, reason: `Value ${JSON.stringify(value)} fails type/range check for ${key} (expected ${entry.type})` };
    }
  }
  return { valid: true };
}

module.exports = {
  REGISTRY,
  getSetting,
  resolveSettingSource,
  validateSetting,
  // Exported for use by CLI command
  userSettingsTomlPath,
  projectTomlPath,
  writeTomlKey,
  readTomlKey,
  UNSET_SENTINEL,
  coerce,
  findEntry,
};
