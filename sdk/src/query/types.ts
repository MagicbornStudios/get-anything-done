export interface QueryTask {
  id: string;
  agentId: string;
  agentRole: string;
  runtime: string;
  modelProfile: string;
  resolvedModel: string;
  claimed: boolean;
  claimedAt: string;
  leaseExpiresAt: string;
  skill: string;
  type: string;
  goal: string;
  status: string;
  phase: string;
  keywords: string;
  depends: string;
  commands: string[];
  files: string[];
}

export interface QueryPhase {
  id: string;
  title: string;
  goal: string;
  status: string;
  depends: string;
  milestone?: string;
  plans?: string;
  requirements?: string;
  description: string;
}

export interface AgentLaneRecord {
  agentId: string;
  agentRole: string;
  runtime: string;
  runtimeSessionId: string | null;
  parentAgentId: string | null;
  rootAgentId: string | null;
  depth: number;
  modelProfile: string | null;
  resolvedModel: string | null;
  humanOperator: boolean;
  status: 'active' | 'released';
  claimedTaskIds: string[];
  claimedPhaseIds: string[];
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  leaseExpiresAt: string | null;
}

export interface AgentLaneState {
  version: number;
  agents: AgentLaneRecord[];
  sequenceByKey: Record<string, number>;
}

export interface RuntimeIdentity {
  id: string;
  source: string;
  model: string | null;
}

export interface AgentBootstrapOptions {
  requestedAgentId?: string;
  role?: string;
  runtime?: string;
  runtimeSessionId?: string | null;
  parentAgentId?: string | null;
  modelProfile?: string | null;
  resolvedModel?: string | null;
  leaseExpiresAt?: string | null;
}

export interface AgentBootstrapResult {
  agent: AgentLaneRecord;
  autoRegistered: boolean;
  state: AgentLaneState;
  lanesPath: string;
}

export interface SimplifiedAgentLane {
  agentId: string;
  agentRole: string;
  runtime: string;
  depth: number;
  parentAgentId: string | null;
  rootAgentId: string | null;
  modelProfile: string | null;
  resolvedModel: string | null;
  tasks: string[];
  lastSeenAt: string | null;
  status: string;
}

export interface AssignmentCollision {
  taskId: string;
  agentId: string;
  agentRole: string | null;
  runtime: string | null;
  status: string;
}

export interface AssignmentView {
  self: string[];
  activeAgents: SimplifiedAgentLane[];
  collisions: AssignmentCollision[];
  staleAgents: SimplifiedAgentLane[];
}

export interface SnapshotScope {
  projectId: string;
  phaseId: string | null;
  taskId: string | null;
  snapshotMode: 'project' | 'phase' | 'task';
  isScoped: boolean;
}

export interface SnapshotAgentView {
  agentId: string;
  agentRole: string;
  runtime: string;
  runtimeSessionId: string | null;
  parentAgentId: string | null;
  rootAgentId: string;
  depth: number;
  modelProfile: string | null;
  resolvedModel: string | null;
  autoRegistered: boolean;
  humanOperator: boolean;
}

export interface ScopedSnapshotOptions {
  projectId?: string;
  phaseId?: string;
  taskId?: string;
  agentId?: string;
  role?: string;
  runtime?: string;
  parentAgentId?: string | null;
  modelProfile?: string | null;
  resolvedModel?: string | null;
  humanFallback?: boolean;
}

export interface ScopedSnapshotResult {
  projectId: string;
  planningDir: string;
  sdkAssetAliases: Record<string, string>;
  scope: SnapshotScope;
  agent: SnapshotAgentView | null;
  assignments: AssignmentView;
  stateXml: string | null;
  task: QueryTask | null;
  phase: QueryPhase | null;
  peerTasks: QueryTask[];
  allTasks: QueryTask[];
  allPhases: QueryPhase[];
  docsMapXml: string | null;
}

export interface ClaimTaskOptions {
  taskId: string;
  agentId?: string;
  role?: string;
  runtime?: string;
  parentAgentId?: string | null;
  modelProfile?: string | null;
  resolvedModel?: string | null;
  leaseExpiresAt?: string | null;
  status?: string;
}

export interface ClaimTaskResult {
  agent: AgentLaneRecord;
  autoRegistered: boolean;
  task: QueryTask;
}

export interface ReleaseTaskOptions {
  taskId: string;
  agentId?: string;
  done?: boolean;
  status?: string;
}

export interface ReleaseTaskResult {
  agent: AgentLaneRecord | null;
  task: QueryTask;
}

export interface ActiveAssignmentsResult {
  activeTasks: QueryTask[];
  activeAgents: SimplifiedAgentLane[];
  staleAgents: SimplifiedAgentLane[];
}
