import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

import { runPhaseStepSession } from './session-runner.js';
import { GSDEventStream } from './event-stream.js';
import { GSDEventType, PhaseStepType, type GSDSessionInitEvent } from './types.js';
import type { GSDConfig } from './config.js';

const RUN_LIVE = process.env.GAD_RUN_LIVE_MODEL_PROFILE_TEST === '1';

function hasClaude(): boolean {
  try {
    if (process.platform === 'win32') {
      execSync('where.exe claude', { stdio: 'ignore' });
    } else {
      execSync('which claude', { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

function createConfig(profile: string): GSDConfig {
  return {
    model_profile: profile,
    commit_docs: true,
    parallelization: true,
    search_gitignored: false,
    brave_search: false,
    firecrawl: false,
    exa_search: false,
    git: {
      branching_strategy: 'none',
      phase_branch_template: 'gad/phase-{phase}-{slug}',
      milestone_branch_template: 'gad/{milestone}-{slug}',
      quick_branch_template: null,
    },
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
      nyquist_validation: true,
      auto_advance: false,
      node_repair: true,
      node_repair_budget: 1,
      ui_phase: false,
      ui_safety_gate: false,
      text_mode: false,
      research_before_questions: false,
      discuss_mode: 'discuss',
      skip_discuss: false,
      max_discuss_passes: 1,
    },
    hooks: {
      context_warnings: true,
    },
    agent_skills: {},
  };
}

describe.skipIf(!RUN_LIVE || !hasClaude())('live model profile switching', () => {
  it('changes the actual Claude session model between balanced and budget profiles', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'gad-live-model-profile-'));
    await mkdir(join(projectDir, '.planning'), { recursive: true });
    await writeFile(join(projectDir, '.planning', 'config.json'), JSON.stringify({ model_profile: 'off' }, null, 2));

    async function runProfile(profile: string) {
      const eventStream = new GSDEventStream();
      const initEvents: GSDSessionInitEvent[] = [];
      eventStream.on(GSDEventType.SessionInit, (event) => {
        initEvents.push(event as GSDSessionInitEvent);
      });

      const result = await runPhaseStepSession(
        'Reply with exactly OK and do not use tools.',
        PhaseStepType.Research,
        createConfig(profile),
        {
          maxTurns: 1,
          maxBudgetUsd: 0.2,
          cwd: projectDir,
          allowedTools: ['Read'],
        },
        eventStream,
        {},
      );

      return {
        result,
        initModel: initEvents[0]?.model ?? null,
      };
    }

    try {
      const balanced = await runProfile('balanced');
      const budget = await runProfile('budget');

      expect(balanced.result.success).toBe(true);
      expect(budget.result.success).toBe(true);
      expect(balanced.initModel).toBeTruthy();
      expect(budget.initModel).toBeTruthy();
      expect(balanced.initModel).not.toBe(budget.initModel);
      expect(balanced.initModel).toContain('sonnet');
      expect(budget.initModel).toContain('haiku');
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  }, 180_000);
});
