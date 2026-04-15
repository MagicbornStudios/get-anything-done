#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
if (!uri || !dbName) {
  console.error("Missing MONGODB_URI or MONGODB_DB");
  process.exit(1);
}

const dbPath = path.join(process.cwd(), "data", "db.json");
const payload = JSON.parse(await fs.readFile(dbPath, "utf8"));

const mod = await import("mongodb");
const client = new mod.MongoClient(uri, { maxPoolSize: 5 });

try {
  await client.connect();
  const db = client.db(dbName);
  await db.collection("db_viewer_payload").updateOne(
    { _id: "latest" },
    {
      $set: {
        payload,
        synced_at: new Date().toISOString(),
        source: "site/data/db.json",
      },
    },
    { upsert: true },
  );
  console.log(`Synced db.json to ${dbName}.db_viewer_payload#latest`);
} finally {
  await client.close();
}
