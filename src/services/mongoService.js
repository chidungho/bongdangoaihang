const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const env = require("../config/env");
const User = require("../models/userModel");

let blogReady = false;

async function connectMongo() {
  if (!env.mongodbUri) {
    return false;
  }
  await mongoose.connect(env.mongodbUri);
  blogReady = true;
  return true;
}

async function seedAdminAccount() {
  if (!blogReady || !env.adminEmail || !env.adminPassword) return;
  const exists = await User.findOne({ email: env.adminEmail }).lean();
  if (exists) return;
  const passwordHash = await bcrypt.hash(env.adminPassword, 10);
  await User.create({
    name: env.adminName,
    email: env.adminEmail,
    passwordHash,
    role: "admin",
  });
}

function isBlogReady() {
  return blogReady;
}

module.exports = {
  connectMongo,
  seedAdminAccount,
  isBlogReady,
};
