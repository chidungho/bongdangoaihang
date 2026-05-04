const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const env = require("../config/env");
const User = require("../models/userModel");
const BlogPost = require("../models/blogPostModel");

let blogReady = false;

async function connectMongo() {
  if (!env.mongodbUri) {
    return false;
  }
  await mongoose.connect(env.mongodbUri);
  blogReady = true;
  return true;
}

async function seedAdminAccount() {
  if (!blogReady || !env.adminEmail || !env.adminPassword) return;
  const exists = await User.findOne({ email: env.adminEmail }).lean();
  if (exists) return;
  const passwordHash = await bcrypt.hash(env.adminPassword, 10);
  await User.create({
    name: env.adminName,
    email: env.adminEmail,
    passwordHash,
    role: "admin",
  });
}

function toSlug(title) {
  return require("slugify")(String(title || ""), { lower: true, strict: true, locale: "vi" });
}

async function seedBlogPostsIfNeeded() {
  if (!blogReady) return;
  
  // Checking if there are any published blog posts
  const postCount = await BlogPost.countDocuments({ status: "published" });
  if (postCount > 0) return; // Only seed if empty

  // Get admin to set as author
  const adminAuthor = await User.findOne({ email: env.adminEmail }).lean();
  const authorId = adminAuthor ? adminAuthor._id : new mongoose.Types.ObjectId();
  const authorName = adminAuthor ? adminAuthor.name : env.adminName;

  const samplePosts = [
    {
      title: 'Ngoai hang Anh 2026: Lịch thi đấu, thể thức và điểm mới cần biết',
      excerpt: 'Toàn cảnh Ngoại hạng Anh 2026: mốc thời gian, lịch thi đấu, thể thức và các thay đổi quan trọng với cuộc đua vô địch.',
      category: 'Ngoại hạng Anh',
      tags: ['ngoại hạng anh', 'lịch thi đấu', 'bóng đá anh', 'seo'],
      contentHtml: '<h2>Tổng quan mùa giải</h2><p>Ngoại hạng Anh 2026 bước vào giai đoạn cạnh tranh khốc liệt với lịch thi đấu dày và nhiều cuộc đối đầu trực tiếp giữa nhóm đầu bảng.</p>'
    },
    {
      title: 'Cuộc đua top 4 Ngoại hạng Anh: Cơ hội cho ngựa ô',
      excerpt: 'Phân tích cơ hội lọt vào top 4 của các đội bóng bất ngờ nổi lên ở mùa giải Ngoại hạng Anh năm nay.',
      category: 'Ngoại hạng Anh',
      tags: ['ngoại hạng anh', 'top 4', 'bóng đá anh'],
      contentHtml: '<h2>Diễn biến nhóm dự cúp châu Âu</h2><p>Ngoài các ứng cử viên quen thuộc, một vài đội bóng tầm trung đang thể hiện phong độ ấn tượng và sẵn sàng chen chân vào top 4.</p>'
    },
    {
      title: 'Bảng xếp hạng Ngoại hạng Anh mới nhất: Phân tích 5 vòng tới',
      excerpt: 'Những thay đổi trên bảng xếp hạng và dự đoán 5 vòng đấu tới sẽ thay đổi cục diện giải đấu như thế nào.',
      category: 'Ngoại hạng Anh',
      tags: ['ngoại hạng anh', 'bảng xếp hạng', 'bóng đá'],
      contentHtml: '<h2>Cục diện bảng xếp hạng</h2><p>Các trận đấu đan chéo sắp tới sẽ quyết định phần lớn vị trí của nửa trên bảng xếp hạng trước kỳ nghỉ đông.</p>'
    },
    {
      title: 'Chiến thuật Ngoại hạng Anh: Đội hình nào đang thống trị?',
      excerpt: 'Cùng chuyên gia phân tích những đội hình tấn công và phòng ngự đỉnh cao nhất tại giải Ngoại hạng thời điểm hiện tại.',
      category: 'Ngoại hạng Anh',
      tags: ['ngoại hạng anh', 'chiến thuật', 'huấn luyện viên'],
      contentHtml: '<h2>Phân tích lối chơi</h2><p>Lối đá pressing tầm cao của các đội bóng dẫn đầu đang gây ra khó khăn lớn cho các đội chiếu dưới.</p>'
    },
    {
      title: 'Cầu thủ Ngoại hạng Anh đáng xem nhất tuần qua',
      excerpt: 'Điểm mặt những ngôi sao sở hữu phong độ chói sáng và sẵn sàng tỏa sáng ở vòng đấu cực kì quan trọng tiếp theo.',
      category: 'Ngoại hạng Anh',
      tags: ['ngoại hạng anh', 'ngôi sao', 'cầu thủ'],
      contentHtml: '<h2>Ngôi sao vòng đấu</h2><p>Nhiều tiền đạo mũi nhọn liên tục lập công, nhưng sự đóng góp thầm lặng của các tiền vệ phòng ngự mới là chìa khóa của top 3.</p>'
    }
  ];

  for (const p of samplePosts) {
    const slug = `${toSlug(p.title)}-${Date.now().toString(36)}`;
    await BlogPost.create({
      title: p.title,
      slug,
      excerpt: p.excerpt,
      contentHtml: p.contentHtml,
      status: "published",
      category: p.category,
      tags: p.tags,
      authorId,
      authorName,
      publishedAt: new Date()
    });
  }
}

function isBlogReady() {
  return blogReady;
}

module.exports = {
  connectMongo,
  seedAdminAccount,
  seedBlogPostsIfNeeded,
  isBlogReady,
};
