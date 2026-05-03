const slugify = require("slugify");
const BlogPost = require("../models/blogPostModel");
const { isBlogReady } = require("../services/mongoService");

function ensureBlogReady(res) {
  if (isBlogReady()) return true;
  res.status(503).json({ error: "Blog system unavailable" });
  return false;
}

function toSlug(title) {
  return slugify(String(title || ""), { lower: true, strict: true, locale: "vi" });
}

async function listPublicPosts(req, res) {
  if (!ensureBlogReady(res)) return;
  const posts = await BlogPost.find({ status: "published" })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(50)
    .lean();
  res.json({ data: posts });
}

async function getPublicPost(req, res) {
  if (!ensureBlogReady(res)) return;
  const post = await BlogPost.findOne({ slug: req.params.slug, status: "published" }).lean();
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json({ data: post });
}

async function listMyPosts(req, res) {
  if (!ensureBlogReady(res)) return;
  const filter = req.user.role === "admin" ? {} : { authorId: req.user._id };
  const posts = await BlogPost.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
  res.json({ data: posts });
}

async function createPost(req, res) {
  if (!ensureBlogReady(res)) return;
  const title = String(req.body?.title || "").trim();
  const contentHtml = String(req.body?.contentHtml || "").trim();
  if (!title || !contentHtml) return res.status(400).json({ error: "Title and content are required" });
  const post = await BlogPost.create({
    title,
    slug: `${toSlug(title)}-${Date.now().toString(36)}`,
    excerpt: String(req.body?.excerpt || "").trim(),
    contentHtml,
    coverImage: String(req.body?.coverImage || "").trim(),
    status: String(req.body?.status || "draft"),
    category: String(req.body?.category || "Tin tức").trim(),
    tags: Array.isArray(req.body?.tags) ? req.body.tags.map((x) => String(x).trim()).filter(Boolean) : [],
    authorId: req.user._id,
    authorName: req.user.name,
    publishedAt: req.body?.status === "published" ? new Date() : null,
  });
  res.status(201).json({ data: post });
}

async function updatePost(req, res) {
  if (!ensureBlogReady(res)) return;
  const post = await BlogPost.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (req.user.role !== "admin" && String(post.authorId) !== String(req.user._id)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.body?.title) post.title = String(req.body.title).trim();
  if (req.body?.excerpt !== undefined) post.excerpt = String(req.body.excerpt || "").trim();
  if (req.body?.contentHtml) post.contentHtml = String(req.body.contentHtml).trim();
  if (req.body?.coverImage !== undefined) post.coverImage = String(req.body.coverImage || "").trim();
  if (req.body?.category !== undefined) post.category = String(req.body.category || "Tin tức").trim();
  if (Array.isArray(req.body?.tags)) post.tags = req.body.tags.map((x) => String(x).trim()).filter(Boolean);
  if (req.body?.status) {
    post.status = String(req.body.status);
    post.publishedAt = post.status === "published" ? post.publishedAt || new Date() : null;
  }
  if (req.body?.title) post.slug = `${toSlug(post.title)}-${post._id.toString().slice(-6)}`;
  await post.save();
  res.json({ data: post });
}

async function deletePost(req, res) {
  if (!ensureBlogReady(res)) return;
  const post = await BlogPost.findById(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (req.user.role !== "admin" && String(post.authorId) !== String(req.user._id)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  await post.deleteOne();
  res.json({ ok: true });
}

module.exports = {
  listPublicPosts,
  getPublicPost,
  listMyPosts,
  createPost,
  updatePost,
  deletePost,
};
