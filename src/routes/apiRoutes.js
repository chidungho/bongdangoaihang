const express = require("express");
const rateLimit = require("express-rate-limit");
const env = require("../config/env");
const { listMatches } = require("../controllers/matchController");
const { listStandings } = require("../controllers/standingsController");
const { getHealth } = require("../controllers/healthController");
const { login } = require("../controllers/authController");
const {
  listPublicPosts,
  getPublicPost,
  listMyPosts,
  createPost,
  updatePost,
  deletePost,
} = require("../controllers/blogController");
const { getNewsBanners, updateNewsBanners } = require("../controllers/newsBannerController");
const { getFooterBanner, updateFooterBanner } = require("../controllers/footerBannerController");
const { requireAuth, requireRole } = require("../middlewares/auth");

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/health", getHealth);
router.get("/matches", listMatches);
router.get("/standings", listStandings);

router.post("/auth/login", authLimiter, login);

router.get("/blog/posts", listPublicPosts);
router.get("/blog/posts/:slug", getPublicPost);
router.get("/system/news-banners", getNewsBanners);
router.get("/system/footer-banner", getFooterBanner);

router.get("/dashboard/posts", requireAuth, listMyPosts);
router.post("/dashboard/posts", requireAuth, createPost);
router.put("/dashboard/posts/:id", requireAuth, updatePost);
router.delete("/dashboard/posts/:id", requireAuth, deletePost);
router.put("/dashboard/system/news-banners", requireAuth, requireRole("admin"), updateNewsBanners);
router.put("/dashboard/system/footer-banner", requireAuth, requireRole("admin"), updateFooterBanner);

module.exports = router;
