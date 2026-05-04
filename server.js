const env = require("./src/config/env");
const { createApp } = require("./src/app");
const { connectMongo, seedAdminAccount, seedBlogPostsIfNeeded } = require("./src/services/mongoService");
const { initializeMatchCache } = require("./src/services/matchService");

const app = createApp();

async function bootstrap() {
  try {
    const connected = await connectMongo();
    if (connected) {
      await seedAdminAccount();
      await seedBlogPostsIfNeeded();
      console.info("[BOOT] MongoDB connected");
    } else {
      console.warn("[BOOT] MONGODB_URI missing, blog module disabled");
    }
  } catch (error) {
    console.warn("[BOOT] MongoDB connection failed:", error.message);
  }

  await initializeMatchCache();

  app.listen(env.port, () => {
    console.info(`[BOOT] BongDaNgoaiHang.Com is running on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("[BOOT] Fatal startup error:", error);
  process.exit(1);
});
