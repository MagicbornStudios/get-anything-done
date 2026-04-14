/**
 * Context engine — resolves which planning context files are loaded per phase.
 *
 * Different phases need different subsets of context. The current manifest is
 * intentionally minimal: execute gets state plus config, research/plan get the
 * broader planning files, and verify gets the plan/summary pair.
 */

import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { constants } from 'node:fs';

import type { ContextFiles } from './types.js';
import { PhaseType } from './types.js';
import type { GADLogger } from './logger.js';

// ─── File manifest per phase ─────────────────────────────────────────────────

interface FileSpec {
  key: keyof ContextFiles;
  filename: string;
  required: boolean;
}

/**
 * Define which files each phase needs. Required files emit warnings when missing;
 * optional files silently return undefined.
 */
const PHASE_FILE_MANIFEST: Record<PhaseType, FileSpec[]> = {
  [PhaseType.Execute]: [
    { key: 'state', filename: 'STATE.md', required: true },
    { key: 'config', filename: 'gad-config.toml', required: false },
  ],
  [PhaseType.Research]: [
    { key: 'state', filename: 'STATE.md', required: true },
    { key: 'roadmap', filename: 'ROADMAP.md', required: true },
    { key: 'context', filename: 'CONTEXT.md', required: true },
    { key: 'requirements', filename: 'REQUIREMENTS.md', required: false },
  ],
  [PhaseType.Plan]: [
    { key: 'state', filename: 'STATE.md', required: true },
    { key: 'roadmap', filename: 'ROADMAP.md', required: true },
    { key: 'context', filename: 'CONTEXT.md', required: true },
    { key: 'research', filename: 'RESEARCH.md', required: false },
    { key: 'requirements', filename: 'REQUIREMENTS.md', required: false },
  ],
  [PhaseType.Verify]: [
    { key: 'state', filename: 'STATE.md', required: true },
    { key: 'roadmap', filename: 'ROADMAP.md', required: true },
    { key: 'requirements', filename: 'REQUIREMENTS.md', required: false },
    { key: 'plan', filename: 'PLAN.md', required: false },
    { key: 'summary', filename: 'SUMMARY.md', required: false },
  ],
  [PhaseType.Discuss]: [
    { key: 'state', filename: 'STATE.md', required: true },
    { key: 'roadmap', filename: 'ROADMAP.md', required: false },
    { key: 'context', filename: 'CONTEXT.md', required: false },
  ],
};

// ─── ContextEngine class ─────────────────────────────────────────────────────

export class ContextEngine {
  private readonly planningDir: string;
  private readonly logger?: GADLogger;

  constructor(projectDir: string, logger?: GADLogger) {
    this.planningDir = join(projectDir, '.planning');
    this.logger = logger;
  }

  /**
   * Resolve context files appropriate for the given phase type.
   * Reads each file defined in the phase manifest, returning undefined
   * for missing optional files and warning for missing required files.
   */
  async resolveContextFiles(phaseType: PhaseType): Promise<ContextFiles> {
    const manifest = PHASE_FILE_MANIFEST[phaseType];
    const result: ContextFiles = {};

    for (const spec of manifest) {
      const content = spec.key === 'config'
        ? await this.readConfigIfExists()
        : await this.readFileIfExists(join(this.planningDir, spec.filename));

      if (content !== undefined) {
        result[spec.key] = content;
      } else if (spec.required) {
        this.logger?.warn(`Required context file missing for ${phaseType} phase: ${spec.filename}`, {
          phase: phaseType,
          file: spec.filename,
          path: join(this.planningDir, spec.filename),
        });
      }
    }

    return result;
  }

  /**
   * Check if a file exists and read it. Returns undefined if not found.
   */
  private async readFileIfExists(filePath: string): Promise<string | undefined> {
    try {
      await access(filePath, constants.R_OK);
      return await readFile(filePath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  /**
   * Prefer canonical config, but keep the JSON mirror readable while older
   * prompts and tools still mention it.
   */
  private async readConfigIfExists(): Promise<string | undefined> {
    const canonicalPath = join(this.planningDir, '..', 'gad-config.toml');
    const compatPath = join(this.planningDir, 'config.json');
    return (await this.readFileIfExists(canonicalPath)) ?? this.readFileIfExists(compatPath);
  }
}

export { PHASE_FILE_MANIFEST };
export type { FileSpec };
