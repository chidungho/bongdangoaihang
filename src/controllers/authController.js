const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");
const User = require("../models/userModel");
const { isBlogReady } = require("../services/mongoService");

function hashToken(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function issueTokens(user) {
  const accessToken = jwt.sign(
    { sub: user._id.toString(), role: user.role, typ: "access", ver: user.tokenVersion || 0 },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
  const refreshToken = jwt.sign(
    { sub: user._id.toString(), role: user.role, typ: "refresh", ver: user.tokenVersion || 0 },
    env.jwtSecret,
    { expiresIn: env.refreshTokenExpiresIn },
  );
  return { accessToken, refreshToken };
}

async function login(req, res) {
  if (!isBlogReady()) {
    return res.status(503).json({ error: "Blog system unavailable" });
  }
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "").trim();
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const user = await User.findOne({ email });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const { accessToken, refreshToken } = issueTokens(user);
  const refreshPayload = jwt.verify(refreshToken, env.jwtSecret);
  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(refreshPayload.exp * 1000);
  await user.save();
  res.json({
    token: accessToken,
    refreshToken,
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
  });
}

async function refresh(req, res) {
  if (!isBlogReady()) {
    return res.status(503).json({ error: "Blog system unavailable" });
  }
  const refreshToken = String(req.body?.refreshToken || "").trim();
  if (!refreshToken) return res.status(400).json({ error: "Refresh token is required" });
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.jwtSecret);
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
  if (payload.typ !== "refresh") return res.status(401).json({ error: "Invalid refresh token" });
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) return res.status(401).json({ error: "Unauthorized" });
  if ((user.tokenVersion || 0) !== (payload.ver || 0)) {
    return res.status(401).json({ error: "Refresh token revoked" });
  }
  if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
    return res.status(401).json({ error: "Refresh token mismatch" });
  }
  if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt.getTime() < Date.now()) {
    return res.status(401).json({ error: "Refresh token expired" });
  }
  const { accessToken, refreshToken: nextRefreshToken } = issueTokens(user);
  const nextPayload = jwt.verify(nextRefreshToken, env.jwtSecret);
  user.refreshTokenHash = hashToken(nextRefreshToken);
  user.refreshTokenExpiresAt = new Date(nextPayload.exp * 1000);
  await user.save();
  res.json({ token: accessToken, refreshToken: nextRefreshToken });
}

async function logout(req, res) {
  if (!req.userDbDoc) return res.status(401).json({ error: "Unauthorized" });
  req.userDbDoc.tokenVersion = (req.userDbDoc.tokenVersion || 0) + 1;
  req.userDbDoc.refreshTokenHash = "";
  req.userDbDoc.refreshTokenExpiresAt = null;
  await req.userDbDoc.save();
  res.json({ ok: true });
}

module.exports = { login, refresh, logout };
