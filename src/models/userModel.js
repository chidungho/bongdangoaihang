const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "contributor"], default: "contributor" },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    refreshTokenHash: { type: String, default: "" },
    refreshTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
