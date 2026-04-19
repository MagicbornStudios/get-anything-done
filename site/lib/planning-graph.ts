/**
 * Task 42.2-43: planning-graph reader + traversal helpers for the
 * GAD landing site.
 *
 * Reads the prebuild-emitted `data/planning-graph.json` and the
 * derived `data/planning-graph-index.json` (token-inverted lookup).
 * Both files are produced by `site/scripts/build-site-data.mjs` and
 * should always exist (the writer emits stub envelopes when the
 * source `.planning/graph.json` is missing).
 *
 * No DOM, no React. Safe to import from API routes or server
 * components. Loaded once per Node process via module-scope cache.
 */

import fs from "node:fs";
import path from "node:path";

export interface PlanningGraphNode {
  id: string;
  type: string;
  label?: string;
  status?: string;
  goal?: string;
  [key: string]: unknown;
}

export interface PlanningGraphEdge {
  type: string;
  /** Alias for `source` — extractor emits both schemas; reader normalises. */
  from: string;
  /** Alias for `target` — extractor emits both schemas; reader normalises. */
  to: string;
  [key: string]: unknown;
}

interface RawEdge {
  type?: string;
  from?: string;
  to?: string;
  source?: string;
  target?: string;
  [key: string]: unknown;
}

/**
 * Normalise extractor edge shape ({source,target} or {from,to}) to the
 * single {from,to} surface used by the rest of the lib. Returns null
 * when neither pair is present.
 */
function normaliseEdge(raw: RawEdge): PlanningGraphEdge | null {
  const from = raw.from ?? raw.source;
  const to = raw.to ?? raw.target;
  const type = raw.type;
  if (typeof from !== "string" || typeof to !== "string" || typeof type !== "string") {
    return null;
  }
  return { ...raw, type, from, to };
}

export interface PlanningGraphEnvelope {
  available: boolean;
  reason?: string;
  generatedAt?: string;
  projectId?: string;
  sourcePath?: string;
  nodeCount?: number;
  edgeCount?: number;
  nodes: PlanningGraphNode[];
  edges: PlanningGraphEdge[];
}

interface PlanningGraphIndexEnvelope {
  available: boolean;
  generatedAt?: string;
  projectId?: string;
  tokenCount?: number;
  tokens: Record<string, string[]>;
}

const SITE_ROOT = path.resolve(process.cwd());
const GRAPH_FILE = path.join(SITE_ROOT, "data", "planning-graph.json");
const INDEX_FILE = path.join(SITE_ROOT, "data", "planning-graph-index.json");

interface CachedGraph {
  envelope: PlanningGraphEnvelope;
  nodesById: Map<string, PlanningGraphNode>;
  outgoing: Map<string, PlanningGraphEdge[]>;
  incoming: Map<string, PlanningGraphEdge[]>;
}

let cachedGraph: CachedGraph | null = null;
let cachedIndex: PlanningGraphIndexEnvelope | null = null;

function loadJsonOrFallback<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function loadGraph(): CachedGraph {
  if (cachedGraph) return cachedGraph;
  const envelope = loadJsonOrFallback<PlanningGraphEnvelope>(GRAPH_FILE, {
    available: false,
    reason: `not found: ${path.relative(process.cwd(), GRAPH_FILE)}`,
    nodes: [],
    edges: [],
  });

  const nodesById = new Map<string, PlanningGraphNode>();
  for (const node of envelope.nodes) {
    if (typeof node?.id === "string") nodesById.set(node.id, node);
  }
  const outgoing = new Map<string, PlanningGraphEdge[]>();
  const incoming = new Map<string, PlanningGraphEdge[]>();
  // Walk the raw edges, normalise schema (extractor emits source/target;
  // some downstream tools emit from/to), drop malformed entries, and
  // mutate envelope.edges in place so any caller reading them sees
  // the post-normalisation shape too.
  const normalised: PlanningGraphEdge[] = [];
  for (const raw of envelope.edges as unknown as RawEdge[]) {
    const edge = normaliseEdge(raw);
    if (!edge) continue;
    normalised.push(edge);
    const out = outgoing.get(edge.from) ?? [];
    out.push(edge);
    outgoing.set(edge.from, out);
    const inc = incoming.get(edge.to) ?? [];
    inc.push(edge);
    incoming.set(edge.to, inc);
  }
  envelope.edges = normalised;
  cachedGraph = { envelope, nodesById, outgoing, incoming };
  return cachedGraph;
}

function loadIndex(): PlanningGraphIndexEnvelope {
  if (cachedIndex) return cachedIndex;
  cachedIndex = loadJsonOrFallback<PlanningGraphIndexEnvelope>(INDEX_FILE, {
    available: false,
    tokens: {},
  });
  return cachedIndex;
}

/** Reset module-scope caches. Useful in tests; no-op in prod. */
export function _resetPlanningGraphCachesForTests(): void {
  cachedGraph = null;
  cachedIndex = null;
}

/** Full envelope (nodes + edges + metadata). */
export function getPlanningGraph(): PlanningGraphEnvelope {
  return loadGraph().envelope;
}

/** Lookup a single node by id. Returns null when missing. */
export function getPlanningNode(id: string): PlanningGraphNode | null {
  return loadGraph().nodesById.get(id) ?? null;
}

export interface NeighborhoodOptions {
  /** Hop radius (1 = direct neighbours). Defaults to 1. */
  radius?: number;
  /** Restrict to specific edge types (default: all). */
  edgeTypes?: string[];
  /** Restrict to specific node types in the result (default: all). */
  nodeTypes?: string[];
  /** Cap result size to keep API responses small. */
  limit?: number;
}

export interface Neighborhood {
  origin: PlanningGraphNode | null;
  nodes: PlanningGraphNode[];
  edges: PlanningGraphEdge[];
}

/**
 * BFS expansion from `originId` up to `radius` hops, collecting
 * unique nodes + edges that participate in the traversal. Both
 * outgoing and incoming edges count for hops.
 */
export function getNeighborhood(
  originId: string,
  options: NeighborhoodOptions = {},
): Neighborhood {
  const { radius = 1, edgeTypes, nodeTypes, limit = 200 } = options;
  const { nodesById, outgoing, incoming } = loadGraph();
  const origin = nodesById.get(originId) ?? null;
  if (!origin) {
    return { origin: null, nodes: [], edges: [] };
  }
  const edgeTypeSet = edgeTypes ? new Set(edgeTypes) : null;
  const nodeTypeSet = nodeTypes ? new Set(nodeTypes) : null;

  const visited = new Set<string>([originId]);
  const collectedNodes: PlanningGraphNode[] = [origin];
  const collectedEdges: PlanningGraphEdge[] = [];
  let frontier: string[] = [originId];

  for (let hop = 0; hop < radius; hop += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      const candidates = [
        ...(outgoing.get(id) ?? []),
        ...(incoming.get(id) ?? []),
      ];
      for (const edge of candidates) {
        if (edgeTypeSet && !edgeTypeSet.has(edge.type)) continue;
        const otherId = edge.from === id ? edge.to : edge.from;
        if (!nodesById.has(otherId)) continue;
        const otherNode = nodesById.get(otherId)!;
        if (nodeTypeSet && !nodeTypeSet.has(otherNode.type)) continue;
        // Always record the edge once we’ve decided to follow it.
        collectedEdges.push(edge);
        if (!visited.has(otherId)) {
          visited.add(otherId);
          collectedNodes.push(otherNode);
          next.push(otherId);
          if (collectedNodes.length >= limit) {
            return {
              origin,
              nodes: collectedNodes,
              edges: dedupeEdges(collectedEdges),
            };
          }
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  return {
    origin,
    nodes: collectedNodes,
    edges: dedupeEdges(collectedEdges),
  };
}

function dedupeEdges(edges: PlanningGraphEdge[]): PlanningGraphEdge[] {
  const seen = new Set<string>();
  const out: PlanningGraphEdge[] = [];
  for (const e of edges) {
    const key = `${e.type}::${e.from}::${e.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export interface SearchHit {
  node: PlanningGraphNode;
  matchedTokens: string[];
}

/**
 * Token-prefix lookup against the inverted index. Splits the query on
 * non-word boundaries, matches each piece as a substring (so
 * "decis" finds "decision"), and ranks by number of distinct query
 * tokens that hit each node. Designed to layer alongside the existing
 * lib/searchindex full-text — caller is expected to merge.
 */
export function searchPlanningGraph(query: string, limit = 25): SearchHit[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const queryTokens = trimmed
    .split(/[^a-z0-9_-]+/)
    .filter((t) => t.length >= 2);
  if (queryTokens.length === 0) return [];

  const { tokens } = loadIndex();
  const { nodesById } = loadGraph();

  // For each query token, collect indexed tokens that contain it as
  // a substring. Cap the per-query-token expansion to prevent
  // pathological queries from sweeping the whole index.
  const PER_TOKEN_CAP = 200;
  const nodeHits = new Map<string, Set<string>>();
  for (const qt of queryTokens) {
    let matched = 0;
    for (const indexedToken of Object.keys(tokens)) {
      if (matched >= PER_TOKEN_CAP) break;
      if (!indexedToken.includes(qt)) continue;
      matched += 1;
      for (const nodeId of tokens[indexedToken]) {
        const set = nodeHits.get(nodeId) ?? new Set<string>();
        set.add(qt);
        nodeHits.set(nodeId, set);
      }
    }
  }

  const ranked: SearchHit[] = [];
  for (const [nodeId, hits] of nodeHits) {
    const node = nodesById.get(nodeId);
    if (!node) continue;
    ranked.push({ node, matchedTokens: [...hits].sort() });
  }
  // Sort: most query-tokens matched, then alphabetical by id for
  // determinism so callers can cache by `query`.
  ranked.sort((a, b) => {
    if (b.matchedTokens.length !== a.matchedTokens.length) {
      return b.matchedTokens.length - a.matchedTokens.length;
    }
    return a.node.id.localeCompare(b.node.id);
  });
  return ranked.slice(0, limit);
}
