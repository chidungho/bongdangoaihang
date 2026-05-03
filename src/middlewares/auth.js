const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/userModel");
const { isBlogReady } = require("../services/mongoService");

async function requireAuth(req, res, next) {
  if (!isBlogReady()) {
    return res.status(503).json({ error: "Blog system unavailable" });
  }
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive) return res.status(401).json({ error: "Unauthorized" });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
