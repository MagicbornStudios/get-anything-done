'use strict';
/**
 * lib/team/recommend-profile.cjs — rule-based machine-aware team profile recommender
 *
 * Decision: GLOBAL-D-440 (machine-aware team/worker profile system)
 * Reference: .planning/ai-stack/AI-PYRAMID.md section 4 (machine profiles + named team profiles)
 *
 * Exports:
 *   recommendTeamProfile(machineProfile, opts) -> RecommendedProfile
 *
 * MachineProfile fields (from apps/desk/src-tauri/src/machine_profile.rs):
 *   ram_total_gb, ram_free_gb, cpu_cores, cpu_threads,
 *   gpu_present, gpu_name, vram_total_gb, disk_total_gb, disk_free_gb, os
 *
 * Primary signal: ram_free_gb (as per AI-PYRAMID §4 and §9 rule-based spec)
 * Boundary thresholds:
 *   < 4  GB free -> Tiny  / Solo Safe        / 1 worker   / rules+classical ML only
 *   4–8  GB free -> Small / Local ML Support / 1-2 workers / Qwen 0.5B-1.5B Q4
 *   8–16 GB free -> Medium/ Hybrid Coding    / 2-4 workers / Qwen 1.5B-3B Q4
 *  > 16  GB free -> Workstation              / 4-8 workers / 7B-14B
 *
 * Rule: ML later (GLOBAL-D-440). For now: deterministic thresholds only.
 */

const { hasEnoughFreeRam, hasEnoughDisk, supportsLocalModel } = require('../predicates/index.cjs');

// ---------------------------------------------------------------------------
// Constants — thresholds from AI-PYRAMID.md §4
// ---------------------------------------------------------------------------

const THRESHOLDS = {
  TINY_MAX_RAM: 4,   // < 4 GB free -> Tiny
  SMALL_MAX_RAM: 8,  // 4–8 GB free -> Small
  MEDIUM_MAX_RAM: 16 // 8–16 GB free -> Medium; > 16 -> Workstation
};

// Machine class definitions: ordered from most-constrained to most-capable
const MACHINE_CLASSES = [
  {
    machine_class: 'Tiny',
    ramThreshold: THRESHOLDS.TINY_MAX_RAM,          // freeRam < 4
    recommended_workers: 1,
    recommended_team_profile: 'Solo Safe',
    recommended_local_model_tier: 'rules+classical-ML only',
    runtime_mix: '1 foreground coding runtime (Claude/Codex); 0 local-LLM workers; rules+classical-ML only'
  },
  {
    machine_class: 'Small',
    ramThreshold: THRESHOLDS.SMALL_MAX_RAM,          // 4 <= freeRam < 8
    recommended_workers: 2,
    recommended_team_profile: 'Local ML Support',
    recommended_local_model_tier: 'Qwen 0.5B/1.5B Q4',
    runtime_mix: '1 coding runtime + 1 local classifier/summarizer (Qwen 0.5B–1.5B); rules+classical-ML'
  },
  {
    machine_class: 'Medium',
    ramThreshold: THRESHOLDS.MEDIUM_MAX_RAM,         // 8 <= freeRam < 16
    recommended_workers: 4,
    recommended_team_profile: 'Hybrid Coding',
    recommended_local_model_tier: 'Qwen 1.5B/3B Q4',
    runtime_mix: '1–2 coding runtimes + 1 DSL/summarizer (Qwen 1.5B–3B) + 1 evaluator/risk; optional embeddings'
  },
  {
    machine_class: 'Workstation',
    ramThreshold: Infinity,                          // freeRam >= 16
    recommended_workers: 8,
    recommended_team_profile: 'Workstation',
    recommended_local_model_tier: '7B-14B (Qwen/Phi)',
    runtime_mix: '2–4 coding runtimes + 3B–7B worker + embeddings + evaluator; frontier for high-risk only'
  }
];

// ---------------------------------------------------------------------------
// recommendTeamProfile
// ---------------------------------------------------------------------------

/**
 * Recommend a team profile based on machine hardware.
 *
 * @param {object} machineProfile - Hardware snapshot (from Tauri machine_profile command)
 * @param {number} machineProfile.ram_free_gb   - Free/available RAM in gigabytes
 * @param {number} machineProfile.disk_free_gb  - Free disk space in gigabytes
 * @param {boolean} [machineProfile.gpu_present] - Whether a GPU was detected
 * @param {number|null} [machineProfile.vram_total_gb] - GPU VRAM in GB (null if no GPU)
 * @param {number} [machineProfile.cpu_cores]   - Physical CPU cores
 * @param {number} [machineProfile.cpu_threads] - Logical CPU threads
 * @param {string} [machineProfile.os]          - OS identifier string
 *
 * @param {object} [opts]
 * @param {number} [opts.currentWorkers]  - Currently running workers (for overcommit check)
 *
 * @returns {{
 *   machine_class: 'Tiny'|'Small'|'Medium'|'Workstation',
 *   recommended_workers: number,
 *   recommended_team_profile: string,
 *   recommended_local_model_tier: string,
 *   runtime_mix: string,
 *   warnings: string[]
 * }}
 */
function recommendTeamProfile(machineProfile, opts = {}) {
  const freeRam = (machineProfile && typeof machineProfile.ram_free_gb === 'number')
    ? machineProfile.ram_free_gb
    : 0;
  const freeDisk = (machineProfile && typeof machineProfile.disk_free_gb === 'number')
    ? machineProfile.disk_free_gb
    : 0;

  const warnings = [];

  // ── Select machine class using predicate: hasEnoughFreeRam ──────────────
  // Walk thresholds in order (Tiny -> Small -> Medium -> Workstation)
  // The first class whose ramThreshold > freeRam wins (i.e. freeRam < threshold).
  // Workstation has Infinity threshold, so it is always the fallback.
  let selected = MACHINE_CLASSES[MACHINE_CLASSES.length - 1]; // default: Workstation
  for (const cls of MACHINE_CLASSES) {
    // Use predicate: "does NOT have enough free RAM to clear the threshold"
    // i.e. freeRam < cls.ramThreshold  =>  this is the right class
    const check = hasEnoughFreeRam.evaluate({ freeRamGb: freeRam, requiredGb: cls.ramThreshold });
    if (!check.ok) {
      // freeRam < cls.ramThreshold — this class fits
      selected = cls;
      break;
    }
    // freeRam >= cls.ramThreshold — continue to next tier
  }

  // ── Disk constraint check ────────────────────────────────────────────────
  // Warn when free disk is very low; doesn't change class but signals risk.
  const diskCheck = hasEnoughDisk.evaluate({ freeDiskGb: freeDisk, requiredGb: 10 });
  if (!diskCheck.ok) {
    warnings.push(
      `Low free disk: ${freeDisk.toFixed(1)} GB (<10 GB). ` +
      `Local model download may fail. Free up disk before loading Qwen or larger models.`
    );
  }

  // ── Local model feasibility annotation ──────────────────────────────────
  // For Small+, check whether the recommended model tier is actually loadable
  // on this machine (uses supportsLocalModel predicate as an explainable audit).
  if (selected.machine_class === 'Small') {
    const modelCheck = supportsLocalModel.evaluate({ freeRamGb: freeRam, freeDiskGb: freeDisk, modelId: 'qwen-0.5b' });
    if (!modelCheck.ok) {
      warnings.push(`Qwen 0.5B may not fit: ${modelCheck.reason}`);
    }
  } else if (selected.machine_class === 'Medium') {
    const modelCheck = supportsLocalModel.evaluate({ freeRamGb: freeRam, freeDiskGb: freeDisk, modelId: 'qwen-1.5b' });
    if (!modelCheck.ok) {
      warnings.push(`Qwen 1.5B may not fit: ${modelCheck.reason}`);
    }
  }

  // ── Overcommit warning ───────────────────────────────────────────────────
  const currentWorkers = (opts && typeof opts.currentWorkers === 'number')
    ? opts.currentWorkers
    : null;

  if (currentWorkers !== null && currentWorkers > selected.recommended_workers) {
    warnings.push(
      `Overcommit: ${currentWorkers} workers running but only ${selected.recommended_workers} recommended ` +
      `for ${selected.machine_class} (${freeRam.toFixed(1)} GB free RAM). ` +
      `Risk of OOM — reduce to ${selected.recommended_workers} worker(s).`
    );
  }

  return {
    machine_class: selected.machine_class,
    recommended_workers: selected.recommended_workers,
    recommended_team_profile: selected.recommended_team_profile,
    recommended_local_model_tier: selected.recommended_local_model_tier,
    runtime_mix: selected.runtime_mix,
    warnings
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { recommendTeamProfile };
