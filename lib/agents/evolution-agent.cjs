'use strict';
/**
 * lib/agents/evolution-agent.cjs — Evolution agent loadout + handoff dispatcher.
 *
 * Phase 107-01: defines the skill loadout, profile, and dispatch helper for the
 * evolution agent. This agent is responsible for scanning, validating, and
 * promoting proto-skills through the evolution pipeline.
 *
 * Exports:
 *   EVOLUTION_AGENT_SKILLS    — ordered skill id array the agent loads
 *   EVOLUTION_AGENT_PROFILE   — name/role/model/tools/paths descriptor
 *   dispatchEvolutionAgent({ prompt, projectRoot, projectid, phase, dryRun, fsImpl })
 *     → { id: string } (handoff id) or { id: null, dryRun: true, body: string }
 */

const path = require('path');
const { createHandoff } = require('../handoffs.cjs');

// ---------------------------------------------------------------------------
// Skill loadout
// ---------------------------------------------------------------------------

/**
 * Ordered skill ids the evolution agent loads before executing any prompt.
 * Runtimes that support the Skill tool (claude-code) can call each in sequence.
 * Text-based runtimes (codex/gemini/opencode) receive the list baked into the
 * handoff body via the SITREP block so they know which skills to request in
 * their stdin context.
 */
const EVOLUTION_AGENT_SKILLS = [
  'find-sprites',
  'create-proto-skill',
  'gad-evolution-evolve',
  'gad-evolution-validator',
  'gad-evolution-images',
];

// ---------------------------------------------------------------------------
// Agent profile
// ---------------------------------------------------------------------------

/**
 * Descriptor consumed by team dispatcher and runtime-substrate scripts.
 *
 * allowed_tools: tools this agent is permitted to call. Restrictive by
 *   default — evolution agents read/write planning artifacts only; no
 *   network, no DB mutations, no package-manager invocations.
 *
 * scoped_paths: path prefixes the agent may write to. Reads are unrestricted.
 */
const EVOLUTION_AGENT_PROFILE = {
  name: 'evolution-agent',
  role: 'reasoner',
  model_preference: 'claude-sonnet-4-6',
  allowed_tools: [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Bash',
  ],
  scoped_paths: [
    '.planning/candidates/',
    '.planning/proto-skills/',
    'ERRORS-AND-ATTEMPTS.xml',
    'vendor/get-anything-done/skills/',
  ],
};

// ---------------------------------------------------------------------------
// Handoff dispatcher
// ---------------------------------------------------------------------------

/**
 * Build the SITREP-shaped handoff body for the evolution agent.
 *
 * @param {object} opts
 * @param {string}  opts.prompt      — operator instruction to the evolution agent
 * @param {string}  [opts.projectid] — target project (default 'global')
 * @param {number|string} [opts.phase] — target phase (default 107)
 * @returns {string}
 */
function buildHandoffBody({ prompt, projectid = 'global', phase = 107 }) {
  const ts = new Date().toISOString();
  const skillList = EVOLUTION_AGENT_SKILLS.map((s) => `  - ${s}`).join('\n');
  const scopedPaths = EVOLUTION_AGENT_PROFILE.scoped_paths.map((p) => `  - ${p}`).join('\n');

  return [
    `## SITREP — evolution-agent dispatch`,
    ``,
    `**Timestamp:** ${ts}`,
    `**Project:** ${projectid}  **Phase:** ${phase}`,
    `**Runtime preference:** claude-code (fallback: codex-cli)`,
    ``,
    `### Mission`,
    ``,
    prompt,
    ``,
    `### Skill loadout (load before first edit)`,
    ``,
    skillList,
    ``,
    `### Scoped write paths`,
    ``,
    scopedPaths,
    ``,
    `### Agent profile`,
    ``,
    `- Role: ${EVOLUTION_AGENT_PROFILE.role}`,
    `- Model: ${EVOLUTION_AGENT_PROFILE.model_preference}`,
    `- Allowed tools: ${EVOLUTION_AGENT_PROFILE.allowed_tools.join(', ')}`,
    ``,
    `### Gaps`,
    ``,
    `- Skill body injection (phase 107-10) not yet shipped — text-based runtimes`,
    `  receive skill list only; they must request skill bodies from stdin context.`,
    `- Review loop (phase 131-09) not yet shipped — no automated post-run scoring.`,
  ].join('\n');
}

/**
 * Dispatch an evolution agent handoff.
 *
 * @param {object} opts
 * @param {string}          opts.prompt      — operator instruction
 * @param {string}          [opts.projectRoot] — repo root (defaults to process.cwd())
 * @param {string}          [opts.projectid]   — target project (default 'global')
 * @param {number|string}   [opts.phase]       — target phase (default 107)
 * @param {boolean}         [opts.dryRun]      — if true, return body without writing
 * @param {object}          [opts.fsImpl]      — injectable fs (for tests)
 * @returns {{ id: string } | { id: null, dryRun: true, body: string }}
 */
function dispatchEvolutionAgent({
  prompt,
  projectRoot,
  projectid = 'global',
  phase = 107,
  dryRun = false,
  fsImpl,
} = {}) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('dispatchEvolutionAgent: prompt is required');
  }

  const baseDir = projectRoot || process.cwd();
  const body = buildHandoffBody({ prompt: prompt.trim(), projectid, phase });

  if (dryRun) {
    return { id: null, dryRun: true, body };
  }

  const { id } = createHandoff({
    baseDir,
    projectid,
    phase: String(phase),
    taskId: null,
    priority: 'normal',
    estimatedContext: 'bounded',
    body,
    createdBy: 'evolution-agent-dispatcher',
    runtimePreference: 'claude-code',
    runtimeFallbacks: ['codex-cli'],
    risk: 'safe',
    time: 'standard',
    surface: 'local',
    fsImpl,
  });

  return { id };
}

module.exports = {
  EVOLUTION_AGENT_SKILLS,
  EVOLUTION_AGENT_PROFILE,
  dispatchEvolutionAgent,
};
