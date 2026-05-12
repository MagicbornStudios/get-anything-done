import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, "index.js")],
  });
  const client = new Client({ name: "gad-memory-smoke", version: "0.0.1" }, { capabilities: {} });
  await client.connect(transport);

  const toolsRes = await client.listTools();
  console.log("=== tools/list ===");
  console.log(`tool count: ${toolsRes.tools.length}`);
  console.log(`tool names: ${toolsRes.tools.map((t) => t.name).join(", ")}`);

  // list_notes
  const notesRes = await client.callTool({ name: "list_notes", arguments: {} });
  const notes = JSON.parse(notesRes.content[0].text);
  console.log("\n=== list_notes (no filter) ===");
  console.log(`count: ${notes.length}`);
  console.log(`first 3 (newest):`);
  for (const n of notes.slice(0, 3)) {
    console.log(`  ${n.path} (${n.sizeBytes}B, mtime=${n.mtime})`);
  }

  // list_notes filtered
  const filteredRes = await client.callTool({
    name: "list_notes",
    arguments: { glob: "windows" },
  });
  const filtered = JSON.parse(filteredRes.content[0].text);
  console.log(`\n=== list_notes glob="windows" ===`);
  console.log(`count: ${filtered.length}`);

  // search_notes
  const searchRes = await client.callTool({
    name: "search_notes",
    arguments: { query: "dispatcher", limit: 3 },
  });
  const searchHits = JSON.parse(searchRes.content[0].text);
  console.log(`\n=== search_notes query="dispatcher" ===`);
  console.log(`hit count: ${searchHits.length}`);
  for (const h of searchHits) {
    console.log(`  ${h.path} (score=${h.score})`);
  }

  // get_note — pick the newest one
  if (notes.length > 0) {
    const target = notes[0].path;
    const noteRes = await client.callTool({ name: "get_note", arguments: { path: target } });
    const note = JSON.parse(noteRes.content[0].text);
    console.log(`\n=== get_note path="${target}" ===`);
    console.log(`content length: ${note.content.length}`);
    console.log(`mtime: ${note.mtime}`);
  }

  // get_note path-escape — must reject
  const escapeRes = await client.callTool({
    name: "get_note",
    arguments: { path: "../STATE.xml" },
  });
  console.log(`\n=== get_note path="../STATE.xml" (escape attempt) ===`);
  console.log(`isError: ${escapeRes.isError ?? false}`);
  console.log(`response: ${escapeRes.content[0].text.slice(0, 100)}`);

  // list_memories
  const memRes = await client.callTool({ name: "list_memories", arguments: {} });
  const mems = JSON.parse(memRes.content[0].text);
  console.log(`\n=== list_memories ===`);
  console.log(`count: ${mems.length}`);
  console.log(`first 3:`);
  for (const m of mems.slice(0, 3)) {
    console.log(`  ${m.slug} (${m.sizeBytes}B) desc="${(m.description ?? "").slice(0, 60)}"`);
  }

  // get_memory
  if (mems.length > 0) {
    const slug = mems[0].slug;
    const oneRes = await client.callTool({ name: "get_memory", arguments: { slug } });
    const one = JSON.parse(oneRes.content[0].text);
    console.log(`\n=== get_memory slug="${slug}" ===`);
    console.log(`content length: ${one.content.length}`);
    console.log(`frontmatter keys: ${one.frontmatter ? Object.keys(one.frontmatter).join(", ") : "<none>"}`);
  }

  // get_memory path-escape — must reject
  const memEscRes = await client.callTool({
    name: "get_memory",
    arguments: { slug: "../../../etc/passwd" },
  });
  console.log(`\n=== get_memory slug="../../../etc/passwd" (escape attempt) ===`);
  console.log(`isError: ${memEscRes.isError ?? false}`);
  console.log(`response: ${memEscRes.content[0].text.slice(0, 100)}`);

  await client.close();
}

main().catch((err) => {
  console.error("smoke fatal:", err);
  process.exit(1);
});
