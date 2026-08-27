import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "./config.js";

test("loads defaults and a comma-separated origin allowlist", () => {
  const config = loadConfig({
    REDIS_URL: "redis://localhost:6379",
    CLIENT_ORIGIN: "https://one.example, https://two.example",
  });
  assert.equal(config.port, 3001);
  assert.deepEqual(config.allowedOrigins, [
    "https://one.example",
    "https://two.example",
  ]);
});

test("rejects invalid configuration", () => {
  assert.throws(() => loadConfig({ REDIS_URL: "not-a-url" }));
});
