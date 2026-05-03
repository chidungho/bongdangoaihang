const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/userModel");
const { isBlogReady } = require("../services/mongoService");

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
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: "24h" });
  res.json({
    token,
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
  });
}

module.exports = { login };
