import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function POST() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    return NextResponse.json({ ok: false, error: "Missing MONGODB_URI or MONGODB_DB" }, { status: 400 });
  }

  const dbPath = path.join(process.cwd(), "data", "db.json");
  let payload;
  try {
    payload = JSON.parse(await fs.readFile(dbPath, "utf8"));
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Failed to read local db.json: ${err.message}` }, { status: 500 });
  }

  let client = null;
  try {
    const mod = await import("mongodb");
    client = new mod.MongoClient(uri, { maxPoolSize: 5 });
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

    return NextResponse.json({ ok: true, target: `${dbName}.db_viewer_payload#latest` });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Mongo sync failed: ${err.message}` }, { status: 500 });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {}
    }
  }
}
