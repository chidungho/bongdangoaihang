const { connectMongo, seedAdminAccount } = require("./services/mongoService");
const { initializeMatchCache } = require("./services/matchService");

let bootstrapPromise = null;

async function bootstrapRuntime(matchOptions) {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      const connected = await connectMongo();
      if (connected) {
        await seedAdminAccount();
        console.info("[BOOT] MongoDB connected");
      } else {
        console.warn("[BOOT] MONGODB_URI missing, blog module disabled");
      }
    } catch (error) {
      console.warn("[BOOT] MongoDB connection failed:", error.message);
    }

    await initializeMatchCache(matchOptions);
  })();

  return bootstrapPromise;
}

module.exports = { bootstrapRuntime };
