const { ensureBlogReady } = require("./services/mongoService");
const { initializeMatchCache } = require("./services/matchService");

let bootstrapPromise = null;

async function bootstrapRuntime(options = {}) {
  if (bootstrapPromise) return bootstrapPromise;
  const {
    connectDatabase = true,
    seedAdmin = connectDatabase,
    ...matchOptions
  } = options || {};

  bootstrapPromise = (async () => {
    if (connectDatabase) {
      try {
        const connected = await ensureBlogReady({ seedAdmin });
        if (connected) {
          console.info("[BOOT] MongoDB connected");
        } else {
          console.warn("[BOOT] MONGODB_URI missing, blog module disabled");
        }
      } catch (error) {
        console.warn("[BOOT] MongoDB connection failed:", error.message);
      }
    }

    await initializeMatchCache(matchOptions);
  })();

  return bootstrapPromise;
}

module.exports = { bootstrapRuntime };
