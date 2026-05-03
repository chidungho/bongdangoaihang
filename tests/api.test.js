const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.SCRAPE_ON_STARTUP = "false";
process.env.MONGODB_URI = "";
process.env.NODE_ENV = "test";

const { createApp } = require("../src/app");

test("health endpoint returns status ok", async () => {
  const app = createApp();
  const res = await request(app).get("/api/health").expect(200);
  assert.equal(res.body.status, "ok");
  assert.equal(typeof res.body.uptime, "number");
});

test("standings endpoint returns object payload", async () => {
  const app = createApp();
  const res = await request(app).get("/api/standings").expect(200);
  assert.equal(typeof res.body.data, "object");
  assert.equal(Array.isArray(res.body.data), false);
});

test("matches endpoint returns normalized matches list", async () => {
  const app = createApp();
  const res = await request(app).get("/api/matches").expect(200);
  assert.equal(Array.isArray(res.body.matches), true);
});

test("login endpoint gracefully handles unavailable blog db", async () => {
  const app = createApp();
  const res = await request(app).post("/api/auth/login").send({ email: "x@y.com", password: "a" });
  assert.equal([400, 503].includes(res.statusCode), true);
});
