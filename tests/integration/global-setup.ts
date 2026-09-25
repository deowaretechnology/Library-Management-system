import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet: MongoMemoryReplSet | undefined;

export async function setup() {
  // A replica set (not a standalone instance) is required because issueBook/returnBook
  // use real Mongoose sessions + transactions, which MongoDB only supports on a replset.
  // Pinned to a long-established version with binaries for every major platform — auto-
  // detecting "latest" can pick a version without a build for your exact OS/distro yet.
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "7.0.14" },
  });
  process.env.MONGODB_URI = replSet.getUri("library");
  process.env.SESSION_SECRET = "integration-test-secret-at-least-32-chars-long";
}

export async function teardown() {
  await replSet?.stop();
}
