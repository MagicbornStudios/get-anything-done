import type {
  ActiveAssignmentsResult,
  ClaimTaskOptions,
  ClaimTaskResult,
  ReleaseTaskOptions,
  ReleaseTaskResult,
  ScopedSnapshotOptions,
  ScopedSnapshotResult,
} from './types.js';
import { listActiveAssignments as listActiveAssignmentsImpl, claimTask as claimTaskImpl, getScopedSnapshot as getScopedSnapshotImpl, releaseTask as releaseTaskImpl } from './scoped-snapshot.js';
import { readRoadmapPhases, readStateXml } from './roadmap.js';
import { readTaskRegistry } from './task-registry.js';
import { readAgentLanes } from './agent-lanes.js';

export class GADQuery {
  constructor(private readonly projectDir: string) {}

  async getScopedSnapshot(options: ScopedSnapshotOptions = {}): Promise<ScopedSnapshotResult> {
    return getScopedSnapshotImpl(this.projectDir, options);
  }

  async readTasks() {
    return readTaskRegistry(this.projectDir);
  }

  async readPhases() {
    return readRoadmapPhases(this.projectDir);
  }

  async readStateXml() {
    return readStateXml(this.projectDir);
  }

  async readAgentLanes() {
    return readAgentLanes(this.projectDir);
  }

  async claimTask(options: ClaimTaskOptions): Promise<ClaimTaskResult> {
    return claimTaskImpl(this.projectDir, options);
  }

  async releaseTask(options: ReleaseTaskOptions): Promise<ReleaseTaskResult> {
    return releaseTaskImpl(this.projectDir, options);
  }

  async listActiveAssignments(): Promise<ActiveAssignmentsResult> {
    return listActiveAssignmentsImpl(this.projectDir);
  }
}

export * from './types.js';
export * from './runtime.js';
export * from './roadmap.js';
export * from './task-registry.js';
export * from './agent-lanes.js';
export * from './scoped-snapshot.js';
