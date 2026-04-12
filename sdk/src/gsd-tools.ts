/**
 * GAD tools bridge — shells out to `gad-tools.cjs` for state management.
 *
 * All `.planning/` state operations go through gad-tools.cjs rather than
 * reimplementing the CLI logic in the SDK.
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { InitNewProjectInfo, PhaseOpInfo, PhasePlanIndex, RoadmapAnalysis } from './types.js';

// ─── Error type ──────────────────────────────────────────────────────────────

export class GSDToolsError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly args: string[],
    public readonly exitCode: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'GSDToolsError';
  }
}

// ─── GSDTools class ──────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;

export class GSDTools {
  private readonly projectDir: string;
  private readonly gsdToolsPath: string;
  private readonly timeoutMs: number;

  constructor(opts: {
    projectDir: string;
    gsdToolsPath?: string;
    timeoutMs?: number;
  }) {
    this.projectDir = opts.projectDir;
    this.gsdToolsPath =
      opts.gsdToolsPath ?? resolveGsdToolsPath(opts.projectDir);
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private getExecCommandAndArgs(command: string, args: string[], raw = false): { executable: string; args: string[] } {
    const commandArgs = [command, ...args];
    if (raw) commandArgs.push('--raw');
    if (this.gsdToolsPath.endsWith('.cjs') || this.gsdToolsPath.endsWith('.js')) {
      return { executable: 'node', args: [this.gsdToolsPath, ...commandArgs] };
    }
    return { executable: this.gsdToolsPath, args: commandArgs };
  }

  // ─── Core exec ───────────────────────────────────────────────────────────

  /**
   * Execute a gsd-tools command and return parsed JSON output.
   * Handles the `@file:` prefix pattern for large results.
   */
  async exec(command: string, args: string[] = []): Promise<unknown> {
    const execution = this.getExecCommandAndArgs(command, args);

    return new Promise<unknown>((resolve, reject) => {
      const child = execFile(
        execution.executable,
        execution.args,
        {
          cwd: this.projectDir,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          timeout: this.timeoutMs,
          env: { ...process.env },
        },
        async (error, stdout, stderr) => {
          const stderrStr = stderr?.toString() ?? '';

          if (error) {
            // Distinguish timeout from other errors
            if (error.killed || (error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
              reject(
                new GSDToolsError(
                  `gsd-tools timed out after ${this.timeoutMs}ms: ${command} ${args.join(' ')}`,
                  command,
                  args,
                  null,
                  stderrStr,
                ),
              );
              return;
            }

            reject(
              new GSDToolsError(
                `gsd-tools exited with code ${error.code ?? 'unknown'}: ${command} ${args.join(' ')}${stderrStr ? `\n${stderrStr}` : ''}`,
                command,
                args,
                typeof error.code === 'number' ? error.code : (error as { status?: number }).status ?? 1,
                stderrStr,
              ),
            );
            return;
          }

          const raw = stdout?.toString() ?? '';

          try {
            const parsed = await this.parseOutput(raw);
            resolve(parsed);
          } catch (parseErr) {
            reject(
              new GSDToolsError(
                `Failed to parse gsd-tools output for "${command}": ${parseErr instanceof Error ? parseErr.message : String(parseErr)}\nRaw output: ${raw.slice(0, 500)}`,
                command,
                args,
                0,
                stderrStr,
              ),
            );
          }
        },
      );

      // Safety net: kill if child doesn't respond to timeout signal
      child.on('error', (err) => {
        reject(
          new GSDToolsError(
            `Failed to execute gsd-tools: ${err.message}`,
            command,
            args,
            null,
            '',
          ),
        );
      });
    });
  }

  /**
   * Parse gsd-tools output, handling `@file:` prefix.
   */
  private async parseOutput(raw: string): Promise<unknown> {
    const trimmed = raw.trim();

    if (trimmed === '') {
      return null;
    }

    let jsonStr = trimmed;
    if (jsonStr.startsWith('@file:')) {
      const filePath = jsonStr.slice(6).trim();
      jsonStr = await readFile(filePath, 'utf-8');
    }

    return JSON.parse(jsonStr);
  }

  // ─── Raw exec (no JSON parsing) ───────────────────────────────────────

  /**
   * Execute a gsd-tools command and return raw stdout without JSON parsing.
   * Use for commands like `config-set` that return plain text, not JSON.
   */
  async execRaw(command: string, args: string[] = []): Promise<string> {
    const execution = this.getExecCommandAndArgs(command, args, true);

    return new Promise<string>((resolve, reject) => {
      const child = execFile(
        execution.executable,
        execution.args,
        {
          cwd: this.projectDir,
          maxBuffer: 10 * 1024 * 1024,
          timeout: this.timeoutMs,
          env: { ...process.env },
        },
        (error, stdout, stderr) => {
          const stderrStr = stderr?.toString() ?? '';
          if (error) {
            reject(
              new GSDToolsError(
                `gsd-tools exited with code ${error.code ?? 'unknown'}: ${command} ${args.join(' ')}${stderrStr ? `\n${stderrStr}` : ''}`,
                command,
                args,
                typeof error.code === 'number' ? error.code : (error as { status?: number }).status ?? 1,
                stderrStr,
              ),
            );
            return;
          }
          resolve((stdout?.toString() ?? '').trim());
        },
      );

      child.on('error', (err) => {
        reject(
          new GSDToolsError(
            `Failed to execute gsd-tools: ${err.message}`,
            command,
            args,
            null,
            '',
          ),
        );
      });
    });
  }

  // ─── Typed convenience methods ─────────────────────────────────────────

  async stateLoad(): Promise<string> {
    return this.execRaw('state', ['load']);
  }

  async roadmapAnalyze(): Promise<RoadmapAnalysis> {
    return this.exec('roadmap', ['analyze']) as Promise<RoadmapAnalysis>;
  }

  async phaseComplete(phase: string): Promise<string> {
    return this.execRaw('phase', ['complete', phase]);
  }

  async commit(message: string, files?: string[]): Promise<string> {
    const args = [message];
    if (files?.length) {
      args.push('--files', ...files);
    }
    return this.execRaw('commit', args);
  }

  async verifySummary(path: string): Promise<string> {
    return this.execRaw('verify-summary', [path]);
  }

  async initExecutePhase(phase: string): Promise<string> {
    return this.execRaw('state', ['begin-phase', '--phase', phase]);
  }

  /**
   * Query phase state from gsd-tools.cjs `init phase-op`.
   * Returns a typed PhaseOpInfo describing what exists on disk for this phase.
   */
  async initPhaseOp(phaseNumber: string): Promise<PhaseOpInfo> {
    const result = await this.exec('init', ['phase-op', phaseNumber]);
    return result as PhaseOpInfo;
  }

  /**
   * Get a config value from gsd-tools.cjs.
   */
  async configGet(key: string): Promise<string | null> {
    const result = await this.exec('config', ['get', key]);
    return result as string | null;
  }

  /**
   * Begin phase state tracking in gsd-tools.cjs.
   */
  async stateBeginPhase(phaseNumber: string): Promise<string> {
    return this.execRaw('state', ['begin-phase', '--phase', phaseNumber]);
  }

  /**
   * Get the plan index for a phase, grouping plans into dependency waves.
   * Returns typed PhasePlanIndex with wave assignments and completion status.
   */
  async phasePlanIndex(phaseNumber: string): Promise<PhasePlanIndex> {
    const result = await this.exec('phase-plan-index', [phaseNumber]);
    return result as PhasePlanIndex;
  }

  /**
   * Query new-project init state from gsd-tools.cjs `init new-project`.
   * Returns project metadata, model configs, brownfield detection, etc.
   */
  async initNewProject(): Promise<InitNewProjectInfo> {
    const result = await this.exec('init', ['new-project']);
    return result as InitNewProjectInfo;
  }

  /**
   * Set a config value via gsd-tools.cjs `config-set`.
   * Handles type coercion (booleans, numbers, JSON) on the gsd-tools side.
   * Note: config-set returns `key=value` text, not JSON, so we use execRaw.
   */
  async configSet(key: string, value: string): Promise<string> {
    return this.execRaw('config-set', [key, value]);
  }
}

// ─── Path resolution ────────────────────────────────────────────────────────

function readMarkerToolsPath(baseDir: string): string | undefined {
  const markerPath = join(baseDir, 'get-anything-done', '.gad-env');
  if (!existsSync(markerPath)) return undefined;
  try {
    const raw = readFileSync(markerPath, 'utf8');
    const parsed = JSON.parse(raw) as { GAD_TOOLS_PATH?: string };
    return parsed.GAD_TOOLS_PATH;
  } catch {
    return undefined;
  }
}

function collectRuntimeConfigDirs(rootDir: string): string[] {
  if (!existsSync(rootDir)) return [];
  const dirs: string[] = [];
  for (const entry of readdirSync(rootDir)) {
    const full = join(rootDir, entry);
    try {
      if (!statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    if (entry.startsWith('.')) {
      dirs.push(full);
      continue;
    }
    if (entry === '.config') {
      for (const nested of readdirSync(full)) {
        const nestedFull = join(full, nested);
        try {
          if (statSync(nestedFull).isDirectory()) dirs.push(nestedFull);
        } catch {
          // ignore
        }
      }
    }
  }
  return dirs;
}

/**
 * Resolve gad-tools.cjs path with env, marker, repo-local, and runtime-dir fallbacks.
 */
export function resolveGsdToolsPath(projectDir: string): string {
  if (process.env.GAD_TOOLS_PATH && existsSync(process.env.GAD_TOOLS_PATH)) {
    return process.env.GAD_TOOLS_PATH;
  }

  const markerBases = [
    projectDir,
    ...collectRuntimeConfigDirs(projectDir),
    homedir(),
    ...collectRuntimeConfigDirs(homedir()),
  ];
  for (const baseDir of markerBases) {
    const markerPath = readMarkerToolsPath(baseDir);
    if (markerPath && existsSync(markerPath)) return markerPath;
  }

  const candidatePaths = [
    join(projectDir, 'vendor', 'get-anything-done', 'bin', 'gad-tools.cjs'),
    join(projectDir, 'get-anything-done', 'bin', 'gad-tools.cjs'),
    join(projectDir, 'bin', 'gad-tools.cjs'),
  ];
  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) return candidate;
  }

  return 'gad-tools';
}
