const { readBanners, saveBanners } = require("../services/newsBannerService");

function setPublicBannerCache(res) {
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
}

function getNewsBanners(req, res) {
  setPublicBannerCache(res);
  res.json({ data: readBanners() });
}

function updateNewsBanners(req, res) {
  const payload = Array.isArray(req.body?.items) ? req.body.items : [];
  const saved = saveBanners(payload);
  res.json({ data: saved });
}

module.exports = {
  getNewsBanners,
  updateNewsBanners,
};
