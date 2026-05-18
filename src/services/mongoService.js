const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const env = require("../config/env");
const User = require("../models/userModel");

let blogReady = false;
const mongoCache =
  globalThis.__bongdangoMongoCache ||
  (globalThis.__bongdangoMongoCache = {
    promise: null,
    seeded: false,
  });

async function connectMongo() {
  if (!env.mongodbUri) {
    blogReady = false;
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    blogReady = true;
    return true;
  }

  if (!mongoCache.promise) {
    mongoCache.promise = mongoose
      .connect(env.mongodbUri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
      })
      .catch((error) => {
        mongoCache.promise = null;
        blogReady = false;
        throw error;
      });
  }

  await mongoCache.promise;
  blogReady = true;
  return true;
}

async function seedAdminAccount() {
  const connected = await connectMongo();
  if (!connected || !env.adminEmail || !env.adminPassword) return;
  if (mongoCache.seeded) return;
  const exists = await User.findOne({ email: env.adminEmail }).lean();
  if (exists) {
    mongoCache.seeded = true;
    return;
  }
  const passwordHash = await bcrypt.hash(env.adminPassword, 10);
  await User.create({
    name: env.adminName,
    email: env.adminEmail,
    passwordHash,
    role: "admin",
  });
  mongoCache.seeded = true;
}

async function ensureBlogReady({ seedAdmin = false } = {}) {
  const connected = await connectMongo();
  if (connected && seedAdmin) {
    await seedAdminAccount();
  }
  return connected;
}

function isBlogReady() {
  return blogReady && mongoose.connection.readyState === 1;
}

module.exports = {
  connectMongo,
  seedAdminAccount,
  ensureBlogReady,
  isBlogReady,
};
