#!/usr/bin/env node
/**
 * Throwaway MongoDB for the UI screenshot pipeline (.github/workflows/ui-screenshots.yml).
 *
 * Starts a single-node replica set with mongodb-memory-server (a replica set, not a plain
 * mongod, because the app's issue/return actions use transactions), writes its connection
 * URI to a file once it is accepting connections, then stays alive until it is killed.
 * Run it in the background and poll for the file:
 *
 *   node scripts/ui-screenshots/mongo.mjs /tmp/mongo-uri.txt > mongo.log 2>&1 &
 *
 * Env: MONGO_URI_FILE (used when no argument is given), MONGOMS_VERSION (default 7.0.14,
 * the version the integration tests pin), MONGO_DB_NAME (default "library").
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const uriFile =
  process.argv[2] || process.env.MONGO_URI_FILE || path.join(os.tmpdir(), "ui-screenshots-mongo-uri.txt");
const version = process.env.MONGOMS_VERSION || "7.0.14";
const dbName = process.env.MONGO_DB_NAME || "library";

const log = (...args) => console.log(new Date().toISOString(), "[mongo]", ...args);

// A stale file from an earlier run would make the caller think we're already up.
fs.rmSync(uriFile, { force: true });

log(`starting a single-node replica set (MongoDB ${version})…`);
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1 },
  binary: { version },
});
await replSet.waitUntilRunning();

const uri = replSet.getUri(dbName);
// Write-then-rename so a poller never reads a half-written URI.
fs.writeFileSync(`${uriFile}.tmp`, uri);
fs.renameSync(`${uriFile}.tmp`, uriFile);
log(`ready at ${uri} (URI written to ${uriFile})`);

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log(`${signal} received, stopping…`);
  try {
    await replSet.stop();
  } catch (err) {
    log("stop failed:", err?.message ?? err);
  }
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Nothing else keeps the event loop busy; stay up until the job (or a signal) ends us.
setInterval(() => {}, 60_000);
