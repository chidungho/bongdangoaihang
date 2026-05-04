const path = require("path");
const env = require("../config/env");

const sendPage = (fileName) => (req, res) => {
  res.sendFile(path.join(env.rootDir, "public", "pages", fileName));
};

module.exports = {
  homePage: sendPage("index.html"),
  blogPage: sendPage("blog.html"),
  blogDetailPage: sendPage("blog-detail.html"),
  adminPage: sendPage("admin.html"),
  contributorPage: sendPage("contributor.html"),
};
