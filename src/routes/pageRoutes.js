const express = require("express");
const env = require("../config/env");
const {
  homePage,
  blogPage,
  blogDetailPage,
  adminPage,
  contributorPage,
} = require("../controllers/pageController");

const router = express.Router();

router.get("/", homePage);
router.get("/blog", blogPage);
router.get("/blog/:slug", blogDetailPage);
router.get("/tin-tuc", blogPage);
router.get("/tin-tuc/:slug", blogDetailPage);
router.get(env.adminPath, adminPage);
router.get(env.contributorPath, contributorPage);

router.get("/live/:slug?", homePage);
router.get("/lich-dau/:slug?", homePage);
router.get("/bxh/:slug?", homePage);
router.get("/ti-so/:slug?", homePage);

module.exports = router;
