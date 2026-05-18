import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;

function ok(label, cond, detail = "") {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}${detail ? "  — " + detail : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${detail ? "  — " + detail : ""}`);
  }
}

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, "index.js")],
  });
  const client = new Client(
    { name: "gad-code-intel-smoke", version: "0.0.1" },
    { capabilities: {} }
  );
  await client.connect(transport);

  console.log("=== tools/list ===");
  const toolsRes = await client.listTools();
  const names = toolsRes.tools.map((t) => t.name).sort();
  console.log(`tool count: ${toolsRes.tools.length}`);
  console.log(`tool names: ${names.join(", ")}`);
  const expected = [
    "find_definition",
    "find_references",
    "list_files",
    "list_imports",
    "read_file",
    "search_code",
  ];
  ok("tools/list returns 6 tools", toolsRes.tools.length === 6, `got ${toolsRes.tools.length}`);
  ok(
    "tools/list contains expected names",
    expected.every((n) => names.includes(n)),
    `expected ${expected.join(",")}`
  );

  // search_code — pick a string we know exists (the server's own resolver fn)
  console.log("\n=== search_code query='findRepoRoot' ===");
  const searchRes = await client.callTool({
    name: "search_code",
    arguments: { query: "findRepoRoot", limit: 20 },
  });
  const searchPayload = JSON.parse(searchRes.content[0].text);
  console.log(`engine: ${searchPayload.engine}`);
  console.log(`count: ${searchPayload.count}`);
  for (const r of searchPayload.results.slice(0, 3)) {
    console.log(`  ${r.file}:${r.line}  ${r.snippet.slice(0, 80)}`);
  }
  ok(
    "search_code('findRepoRoot') returns >=1 result",
    searchPayload.count >= 1,
    `count=${searchPayload.count}`
  );

  // search_code — token_tracker (from task spec)
  console.log("\n=== search_code query='token_tracker' ===");
  const ttRes = await client.callTool({
    name: "search_code",
    arguments: { query: "token_tracker", limit: 10 },
  });
  const ttPayload = JSON.parse(ttRes.content[0].text);
  console.log(`engine: ${ttPayload.engine}  count: ${ttPayload.count}`);
  ok("search_code('token_tracker') returns >=1 result", ttPayload.count >= 1, `count=${ttPayload.count}`);

  // find_definition — PressureBar (known to exist in apps/desk/src/components/pressure-bar.tsx)
  console.log("\n=== find_definition symbol='PressureBar' ===");
  const defRes = await client.callTool({
    name: "find_definition",
    arguments: { symbol: "PressureBar" },
  });
  const defPayload = JSON.parse(defRes.content[0].text);
  console.log(`count: ${defPayload.count}`);
  for (const r of defPayload.results.slice(0, 3)) {
    console.log(`  ${r.file}:${r.line}  [${r.kind}]  ${r.snippet.slice(0, 80)}`);
  }
  const hasPressureBar = defPayload.results.some((r) =>
    r.file.includes("pressure-bar")
  );
  ok(
    "find_definition('PressureBar') returns the component file",
    hasPressureBar,
    `found ${defPayload.count} matches`
  );

  // find_references — short, common symbol; just ensure shape works
  console.log("\n=== find_references symbol='findRepoRoot' ===");
  const refRes = await client.callTool({
    name: "find_references",
    arguments: { symbol: "findRepoRoot", file_glob: "**/*.js" },
  });
  const refPayload = JSON.parse(refRes.content[0].text);
  console.log(`engine: ${refPayload.engine}  count: ${refPayload.count}`);
  ok(
    "find_references('findRepoRoot') returns >=1 result",
    refPayload.count >= 1,
    `count=${refPayload.count}`
  );

  // list_files — apps/desk/src/components, scoped
  console.log("\n=== list_files path='vendor/get-anything-done/mcp-servers' ===");
  const lsRes = await client.callTool({
    name: "list_files",
    arguments: { path: "vendor/get-anything-done/mcp-servers", glob: "**/index.js", limit: 20 },
  });
  const lsPayload = JSON.parse(lsRes.content[0].text);
  console.log(`count: ${lsPayload.count}`);
  for (const f of lsPayload.files.slice(0, 5)) {
    console.log(`  ${f.path} (${f.sizeBytes}B)`);
  }
  ok(
    "list_files returns >=4 index.js files under mcp-servers/",
    lsPayload.count >= 4,
    `count=${lsPayload.count}`
  );

  // read_file — known small file
  console.log("\n=== read_file path='vendor/get-anything-done/mcp-servers/gad-code-intel-server/package.json' ===");
  const readRes = await client.callTool({
    name: "read_file",
    arguments: {
      path: "vendor/get-anything-done/mcp-servers/gad-code-intel-server/package.json",
    },
  });
  const readPayload = JSON.parse(readRes.content[0].text);
  console.log(`total_lines: ${readPayload.total_lines}  lang: ${readPayload.lang}`);
  ok(
    "read_file returns content",
    typeof readPayload.content === "string" && readPayload.content.includes("@gad/mcp-code-intel-server"),
    `len=${readPayload.content?.length ?? 0}`
  );

  // read_file — line range
  console.log("\n=== read_file lines 1-3 of this server's index.js ===");
  const rangeRes = await client.callTool({
    name: "read_file",
    arguments: {
      path: "vendor/get-anything-done/mcp-servers/gad-code-intel-server/index.js",
      start_line: 1,
      end_line: 3,
    },
  });
  const rangePayload = JSON.parse(rangeRes.content[0].text);
  const rangeLines = rangePayload.content.split("\n").length;
  ok(
    "read_file with range returns exactly 3 lines",
    rangeLines === 3,
    `got ${rangeLines}`
  );

  // read_file — path-escape rejection
  console.log("\n=== read_file path='../../../etc/passwd' (escape) ===");
  const escRes = await client.callTool({
    name: "read_file",
    arguments: { path: "../../../etc/passwd" },
  });
  ok(
    "read_file rejects path escape",
    escRes.isError === true,
    escRes.content[0].text.slice(0, 80)
  );

  // list_imports — read this server's own index.js
  console.log("\n=== list_imports file='vendor/get-anything-done/mcp-servers/gad-code-intel-server/index.js' ===");
  const impRes = await client.callTool({
    name: "list_imports",
    arguments: {
      file: "vendor/get-anything-done/mcp-servers/gad-code-intel-server/index.js",
    },
  });
  const impPayload = JSON.parse(impRes.content[0].text);
  console.log(`count: ${impPayload.count}`);
  for (const i of impPayload.imports.slice(0, 5)) {
    console.log(`  L${i.line}  [${i.kind}]  ${i.module}`);
  }
  ok(
    "list_imports finds @modelcontextprotocol/sdk imports",
    impPayload.imports.some((i) => i.module.includes("@modelcontextprotocol/sdk")),
    `count=${impPayload.count}`
  );

  await client.close();

  console.log(`\n=== SUMMARY ===`);
  console.log(`pass: ${pass}`);
  console.log(`fail: ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("smoke fatal:", err);
  process.exit(1);
});
