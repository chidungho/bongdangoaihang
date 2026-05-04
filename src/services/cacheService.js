const env = require("../config/env");
const logger = require("../utils/logger");

let redisClient = null;
let redisReady = false;
const memoryCache = new Map();

async function ensureRedis() {
  if (!env.redisUrl || redisClient) return;
  try {
    const { createClient } = require("redis");
    redisClient = createClient({ url: env.redisUrl });
    redisClient.on("error", (err) => {
      redisReady = false;
      logger.warn("redis_error", { message: err.message });
    });
    await redisClient.connect();
    redisReady = true;
    logger.info("redis_connected");
  } catch (error) {
    redisReady = false;
    redisClient = null;
    logger.warn("redis_unavailable_fallback_memory", { message: error.message });
  }
}

function getMemory(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function setMemory(key, value, ttlSec) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSec * 1000,
  });
}

async function getCache(key) {
  await ensureRedis();
  if (redisReady && redisClient) {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  }
  return getMemory(key);
}

async function setCache(key, value, ttlSec) {
  await ensureRedis();
  if (redisReady && redisClient) {
    await redisClient.setEx(key, ttlSec, JSON.stringify(value));
    return;
  }
  setMemory(key, value, ttlSec);
}

async function delCache(key) {
  await ensureRedis();
  if (redisReady && redisClient) {
    await redisClient.del(key);
  }
  memoryCache.delete(key);
}

module.exports = {
  getCache,
  setCache,
  delCache,
};
