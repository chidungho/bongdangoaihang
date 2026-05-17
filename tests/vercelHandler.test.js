const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

test("Vercel routes all requests to the serverless API handler", () => {
  const configPath = path.join(__dirname, "..", "vercel.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  assert.deepEqual(config.builds, [
    {
      src: "api/index.js",
      use: "@vercel/node",
      config: {
        includeFiles: [
          "public/**",
          "data/**/*.json",
        ],
      },
    },
  ]);
  assert.deepEqual(config.routes, [
    {
      src: "/(.*)",
      dest: "/api/index.js",
    },
  ]);
});

test("src/app default export is a Vercel-compatible fallback handler", async () => {
  process.env.NODE_ENV = "test";
  process.env.VERCEL = "1";
  process.env.MONGODB_URI = "";
  process.env.SCRAPE_ON_STARTUP = "false";

  const appModule = require("../src/app");

  assert.equal(typeof appModule, "function");
  assert.equal(typeof appModule.createApp, "function");
  await request(appModule).get("/").expect(200).expect("Content-Type", /html/);
});

test("Vercel handler serves Express routes without opening a listener", async () => {
  process.env.NODE_ENV = "test";
  process.env.VERCEL = "1";
  process.env.MONGODB_URI = "";
  process.env.SCRAPE_ON_STARTUP = "false";

  const handler = require("../api/index");

  assert.equal(typeof handler, "function");
  await request(handler).get("/health/live").expect(200).expect("Content-Type", /json/);
  await request(handler).get("/").expect(200).expect("Content-Type", /html/);
});
