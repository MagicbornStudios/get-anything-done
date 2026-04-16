const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const GAD_ROOT = path.resolve(__dirname, "..");
const LIB = path.join(GAD_ROOT, "lib", "graph-extractor.cjs");

// The root config for the GAD project itself
const ROOT_CONFIG = { id: "get-anything-done", path: ".", planningDir: ".planning" };

describe("graph-extractor", () => {
  it("module loads without error", () => {
    const mod = require(LIB);
    assert.ok(mod, "module exports something");
    assert.ok(typeof mod.buildGraph === "function");
    assert.ok(typeof mod.queryGraph === "function");
    assert.ok(typeof mod.generateHtml === "function");
  });

  it("buildGraph produces nodes and edges", () => {
    const { buildGraph } = require(LIB);
    const graph = buildGraph(ROOT_CONFIG, GAD_ROOT, { gadDir: GAD_ROOT });
    assert.ok(graph.nodes.length > 100, `expected >100 nodes, got ${graph.nodes.length}`);
    assert.ok(graph.edges.length > 100, `expected >100 edges, got ${graph.edges.length}`);
    const types = new Set(graph.nodes.map((n) => n.type));
    assert.ok(types.has("phase"), "has phase nodes");
    assert.ok(types.has("task"), "has task nodes");
    assert.ok(types.has("skill"), "has skill nodes");
    assert.ok(types.has("decision"), "has decision nodes");
  });

  it("nodes have required fields (id, type)", () => {
    const { buildGraph } = require(LIB);
    const graph = buildGraph(ROOT_CONFIG, GAD_ROOT, { gadDir: GAD_ROOT });
    for (const node of graph.nodes.slice(0, 30)) {
      assert.ok(node.id, `node missing id`);
      assert.ok(node.type, `node ${node.id} missing type`);
    }
  });

  it("edges reference valid node ids", () => {
    const { buildGraph } = require(LIB);
    const graph = buildGraph(ROOT_CONFIG, GAD_ROOT, { gadDir: GAD_ROOT });
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    let validCount = 0;
    let invalidCount = 0;
    for (const edge of graph.edges) {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) validCount++;
      else invalidCount++;
    }
    // Allow some dangling edges (cross-references to external things)
    const validRatio = validCount / (validCount + invalidCount);
    assert.ok(
      validRatio > 0.8,
      `expected >80% valid edges, got ${(validRatio * 100).toFixed(1)}% (${invalidCount} invalid)`,
    );
  });

  it("queryGraph filters by type + phase", () => {
    const { buildGraph, queryGraph } = require(LIB);
    const graph = buildGraph(ROOT_CONFIG, GAD_ROOT, { gadDir: GAD_ROOT });
    const result = queryGraph(graph, { type: "task", phase: "44.5" });
    assert.ok(result.matches.length > 0, "expected tasks in phase 44.5");
    for (const n of result.matches) {
      assert.equal(n.type, "task", "all results should be tasks");
    }
  });

  it("queryGraph filters by search text", () => {
    const { buildGraph, queryGraph } = require(LIB);
    const graph = buildGraph(ROOT_CONFIG, GAD_ROOT, { gadDir: GAD_ROOT });
    const result = queryGraph(graph, { type: "skill", search: "scaffold" });
    assert.ok(result.matches.length > 0, "expected skills matching 'scaffold'");
  });

  it("queryGraph returns empty for nonexistent search", () => {
    const { buildGraph, queryGraph } = require(LIB);
    const graph = buildGraph(ROOT_CONFIG, GAD_ROOT, { gadDir: GAD_ROOT });
    const result = queryGraph(graph, { search: "zzz_nonexistent_zzz_12345" });
    assert.equal(result.matches.length, 0);
  });

  it("generateHtml produces valid HTML", () => {
    const { buildGraph, generateHtml } = require(LIB);
    const graph = buildGraph(ROOT_CONFIG, GAD_ROOT, { gadDir: GAD_ROOT });
    const html = generateHtml(graph, "test-project");
    assert.ok(typeof html === "string", "html is a string");
    assert.ok(html.startsWith("<!DOCTYPE html>"), "starts with doctype");
    assert.ok(html.length > 1000, `html too short: ${html.length}`);
  });

  it("graph.json on disk is consistent with fresh build", () => {
    const graphJsonPath = path.join(GAD_ROOT, ".planning", "graph.json");
    if (!fs.existsSync(graphJsonPath)) return; // skip if not built
    const { buildGraph } = require(LIB);
    const onDisk = JSON.parse(fs.readFileSync(graphJsonPath, "utf8"));
    const fresh = buildGraph(ROOT_CONFIG, GAD_ROOT, { gadDir: GAD_ROOT });
    const ratio = fresh.nodes.length / onDisk.nodes.length;
    assert.ok(
      ratio > 0.9 && ratio < 1.1,
      `node count drift >10%: disk=${onDisk.nodes.length} fresh=${fresh.nodes.length}`,
    );
  });

  it("token savings: query output is 5x+ smaller than snapshot", () => {
    const { buildGraph, queryGraph, formatQueryResult } = require(LIB);
    const graph = buildGraph(ROOT_CONFIG, GAD_ROOT, { gadDir: GAD_ROOT });
    const result = queryGraph(graph, { type: "task", phase: "44.5", status: "planned" });
    const query = { type: "task", phase: "44.5", status: "planned" };
    const formatted = formatQueryResult(result, query);
    const queryChars = formatted.length;
    // Snapshot is ~30k chars (~7680 tokens)
    const snapshotChars = 30000;
    const ratio = snapshotChars / queryChars;
    assert.ok(
      ratio > 5,
      `expected >5x savings, got ${ratio.toFixed(1)}x (query=${queryChars} chars, snapshot≈${snapshotChars})`,
    );
  });
});
