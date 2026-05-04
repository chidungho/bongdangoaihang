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
    if (payload.typ && payload.typ !== "access") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userDoc = await User.findById(payload.sub);
    if (!userDoc || !userDoc.isActive) return res.status(401).json({ error: "Unauthorized" });
    if ((payload.ver || 0) !== (userDoc.tokenVersion || 0)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.userDbDoc = userDoc;
    req.user = userDoc.toObject();
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
