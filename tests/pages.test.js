const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.SCRAPE_ON_STARTUP = "false";
process.env.NODE_ENV = "test";

const { createApp } = require("../src/app");

test("home page serves html", async () => {
  const app = createApp();
  const res = await request(app).get("/").expect(200);
  assert.match(res.headers["content-type"], /text\/html/);
});

test("spa route serves html without 404", async () => {
  const app = createApp();
  const res = await request(app).get("/lich-dau/lich-hom-nay").expect(200);
  assert.match(res.headers["content-type"], /text\/html/);
});
