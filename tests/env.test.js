const test = require("node:test");
const assert = require("node:assert/strict");

test("Vercel runtime does not load repository .env values", () => {
  process.env.VERCEL = "1";
  delete process.env.MONGODB_URI;

  delete require.cache[require.resolve("../src/config/env")];
  const env = require("../src/config/env");

  assert.equal(env.mongodbUri, "");
});
