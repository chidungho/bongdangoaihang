const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");

function clearRuntimeModules() {
  [
    "../api/index",
    "../src/app",
    "../src/bootstrap",
    "../src/config/env",
    "../src/services/mongoService",
  ].forEach((modulePath) => {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // Module may not have been loaded in this test process yet.
    }
  });
}

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

test("Vercel homepage cold start does not open MongoDB before blog/auth routes", async () => {
  process.env.NODE_ENV = "test";
  process.env.VERCEL = "1";
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/bongdango-test";
  process.env.ADMIN_EMAIL = "";
  process.env.ADMIN_PASSWORD = "";
  process.env.SCRAPE_ON_STARTUP = "false";

  clearRuntimeModules();
  const mongoose = require("mongoose");
  const originalConnect = mongoose.connect;
  let connectCalls = 0;
  mongoose.connect = async () => {
    connectCalls += 1;
    return mongoose;
  };

  try {
    const handler = require("../api/index");
    await request(handler).get("/").expect(200).expect("Content-Type", /html/);
    assert.equal(connectCalls, 0);
  } finally {
    mongoose.connect = originalConnect;
    await mongoose.disconnect().catch(() => {});
    clearRuntimeModules();
  }
});
