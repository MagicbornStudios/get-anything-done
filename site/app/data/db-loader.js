import fs from "node:fs/promises";
import path from "node:path";

const LOCAL_DB_PATH = path.join(process.cwd(), "data", "db.json");

async function readLocalPayload() {
  try {
    const raw = await fs.readFile(LOCAL_DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function readMongoPayload() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    return { payload: null, reason: "missing-mongo-env" };
  }

  let client;
  try {
    const mod = await import("mongodb");
    client = new mod.MongoClient(uri, { maxPoolSize: 5 });
    await client.connect();
    const db = client.db(dbName);
    const doc = await db.collection("db_viewer_payload").findOne({ _id: "latest" });
    if (!doc?.payload) return { payload: null, reason: "missing-latest-doc" };
    return { payload: doc.payload, reason: null };
  } catch (err) {
    return { payload: null, reason: `mongo-read-failed:${(err && err.message) || "unknown"}` };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {}
    }
  }
}

export async function loadDbViewerPayload() {
  const source = (process.env.DATA_DB_SOURCE || "local").toLowerCase();
  if (source !== "mongo") {
    return { payload: await readLocalPayload(), source: "local", fallback: null };
  }

  const mongo = await readMongoPayload();
  if (mongo.payload) return { payload: mongo.payload, source: "mongo", fallback: null };

  return {
    payload: await readLocalPayload(),
    source: "local",
    fallback: mongo.reason || "mongo-unavailable",
  };
}
