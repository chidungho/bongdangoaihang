const { readBanners, saveBanners } = require("../services/newsBannerService");

function getNewsBanners(req, res) {
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
