const env = require("./src/config/env");
const { createApp } = require("./src/app");
const { bootstrapRuntime } = require("./src/bootstrap");

const app = createApp();

async function bootstrap() {
  await bootstrapRuntime();

  app.listen(env.port, () => {
    console.info(`[BOOT] BongDaNgoaiHang.Com is running on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("[BOOT] Fatal startup error:", error);
  process.exit(1);
});
