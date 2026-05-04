const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    excerpt: { type: String, trim: true, default: "" },
    contentHtml: { type: String, required: true },
    coverImage: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["draft", "pending", "published"], default: "draft" },
    category: { type: String, trim: true, default: "Tin tức" },
    tags: [{ type: String, trim: true }],
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ authorId: 1, updatedAt: -1 });

module.exports = mongoose.models.BlogPost || mongoose.model("BlogPost", postSchema);
