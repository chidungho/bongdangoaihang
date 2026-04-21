const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const slugify = require('slugify');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '2mb' }));

const REQUEST_LOG_ENABLED = String(process.env.REQUEST_LOG_ENABLED || 'true').toLowerCase() !== 'false';
const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
const RATE_LIMIT_MAX = Number.parseInt(process.env.RATE_LIMIT_MAX || '200', 10);
const AUTH_RATE_LIMIT_MAX = Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || '15', 10);
const CACHE_TTL_MS = Number.parseInt(process.env.CACHE_TTL_MS || '60000', 10);

const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false
});

if (REQUEST_LOG_ENABLED) {
    app.use((req, res, next) => {
        const startedAt = Date.now();
        const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        res.setHeader('X-Request-Id', requestId);
        res.on('finish', () => {
            const latency = Date.now() - startedAt;
            console.log(`[REQ] ${requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${latency}ms`);
        });
        next();
    });
}

app.use('/api', apiLimiter);

const LEAGUE_SCHEDULES = [
    { name: 'Ngoại hạng Anh', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-anh-c48a466567.html' },
    { name: 'CUP C1', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-cup-c1-champions-league-c48a465411.html' },
    { name: 'La Liga', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-tay-ban-nha-c48a468110.html' },
    { name: 'Serie A', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-y-c48a394137.html' },
    { name: 'Bundesliga', url: 'https://www.24h.com.vn/bong-da-duc/lich-thi-dau-bong-da-duc-bundesliga-c152a467108.html' },
    { name: 'Ligue 1', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-phap-c48a394560.html' },
    { name: 'FA Cup', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-fa-cup-c48a682532.html' },
    { name: 'UEFA Europa League', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-europa-league-c48a467859.html' },
];

let globalMatchesCache = null;
let lastScrapeTime = null;
let isScraping = false;
const SCRAPE_INTERVAL_MS = Number.parseInt(process.env.SCRAPE_INTERVAL_MS || '86400000', 10);
const SCRAPE_ON_STARTUP = String(process.env.SCRAPE_ON_STARTUP || 'true').toLowerCase() !== 'false';

const PUBLIC_DIR = __dirname;
const MOCK_MATCHES_PATH = path.join(PUBLIC_DIR, 'public_api_data.json');
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-jwt-secret';
const MONGODB_URI = process.env.MONGODB_URI || '';
const ADMIN_PATH = normalizeRoutePath(process.env.ADMIN_PATH, '/he-thong/quan-tri');
const CONTRIBUTOR_PATH = normalizeRoutePath(process.env.CONTRIBUTOR_PATH, '/he-thong/cong-tac-vien');

let blogReady = false;

function normalizeRoutePath(raw, fallback) {
    const value = String(raw || '').trim();
    if (!value) return fallback;
    return value.startsWith('/') ? value : `/${value}`;
}

function escapeXml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function sanitizePlainText(value, { max = 500, allowEmpty = true } = {}) {
    const cleaned = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!cleaned && !allowEmpty) return '';
    return cleaned.slice(0, max);
}

function sanitizeHtml(value) {
    const raw = String(value ?? '');
    return raw
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
        .replace(/\son\w+=(["']).*?\1/gi, '')
        .replace(/\son\w+=([^\s>]+)/gi, '')
        .replace(/javascript:/gi, '');
}

const responseCache = new Map();

function getCached(key) {
    const hit = responseCache.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
        responseCache.delete(key);
        return null;
    }
    return hit.value;
}

function setCached(key, value, ttlMs = CACHE_TTL_MS) {
    responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
}

function clearCacheByPrefix(prefix) {
    for (const key of responseCache.keys()) {
        if (key.startsWith(prefix)) responseCache.delete(key);
    }
}

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        role: { type: String, enum: ['admin', 'contributor'], default: 'contributor' },
        isActive: { type: Boolean, default: true }
    },
    { timestamps: true }
);

const postSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, trim: true },
        excerpt: { type: String, trim: true, default: '' },
        contentHtml: { type: String, required: true },
        coverImage: { type: String, trim: true, default: '' },
        status: { type: String, enum: ['draft', 'pending', 'published'], default: 'draft' },
        category: { type: String, trim: true, default: 'Tin tức' },
        tags: [{ type: String, trim: true }],
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true },
        publishedAt: { type: Date, default: null }
    },
    { timestamps: true }
);

postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ authorId: 1, updatedAt: -1 });

const User = mongoose.model('User', userSchema);
const BlogPost = mongoose.model('BlogPost', postSchema);

function normalizeSlug(input) {
    return slugify(String(input || ''), { lower: true, strict: true, locale: 'vi' }) || `post-${Date.now()}`;
}

async function ensureUniqueSlug(base, postId = null) {
    const safeBase = normalizeSlug(base);
    let candidate = safeBase;
    let counter = 1;
    while (true) {
        const existing = await BlogPost.findOne({ slug: candidate }).select('_id');
        if (!existing || (postId && existing._id.toString() === postId.toString())) return candidate;
        candidate = `${safeBase}-${counter++}`;
    }
}

function blogNotReady(res) {
    return res.status(503).json({ error: 'Blog chưa sẵn sàng: cần cấu hình MONGODB_URI.' });
}

function signToken(user) {
    return jwt.sign(
        { sub: user._id.toString(), role: user.role, name: user.name, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

async function authRequired(req, res, next) {
    if (!blogReady) return blogNotReady(res);
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Thiếu token xác thực.' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.sub).lean();
        if (!user || !user.isActive) return res.status(401).json({ error: 'Tài khoản không hợp lệ.' });
        req.user = user;
        next();
    } catch {
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
}

function roleRequired(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Chưa xác thực.' });
        if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Không đủ quyền truy cập.' });
        next();
    };
}

async function connectMongo() {
    if (!MONGODB_URI) {
        console.warn('[BLOG] MONGODB_URI chưa được cấu hình, module blog sẽ tạm tắt.');
        return;
    }
    try {
        await mongoose.connect(MONGODB_URI);
        blogReady = true;
        console.log('[BLOG] MongoDB connected.');
    } catch (err) {
        console.error('[BLOG] MongoDB connection error:', err.message);
    }
}

async function seedAdminAccount() {
    if (!blogReady) return;
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
    if (!adminEmail || !adminPassword) {
        console.log('[BLOG] Bỏ qua seed admin: thiếu ADMIN_EMAIL hoặc ADMIN_PASSWORD.');
        return;
    }
    const exists = await User.findOne({ email: adminEmail }).lean();
    if (exists) return;
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await User.create({
        name: process.env.ADMIN_NAME || 'System Admin',
        email: adminEmail,
        passwordHash,
        role: 'admin'
    });
    console.log('[BLOG] Đã tạo tài khoản admin mặc định.');
}

function readMockMatches() {
    try {
        const raw = fs.readFileSync(MOCK_MATCHES_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.matches) ? parsed.matches : []);
    } catch (e) {
        console.warn('Không đọc được public_api_data.json:', e.message);
        return [];
    }
}

function writeMatchesCache(matches) {
    try {
        const payload = JSON.stringify(matches, null, 2);
        fs.writeFileSync(MOCK_MATCHES_PATH, payload, 'utf-8');
    } catch (e) {
        console.warn('Không ghi được public_api_data.json:', e.message);
    }
}

app.use(express.static(PUBLIC_DIR));
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});
app.get('/tin-tuc', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'blog.html')));
app.get('/tin-tuc/:slug', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'blog-detail.html')));
app.get(ADMIN_PATH, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get(CONTRIBUTOR_PATH, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'contributor.html')));

app.get('/blog', (req, res) => res.redirect(302, '/tin-tuc'));
app.get('/blog/:slug', (req, res) => res.redirect(302, `/tin-tuc/${req.params.slug}`));
app.get('/admin', (req, res) => res.redirect(302, ADMIN_PATH));
app.get('/contributor', (req, res) => res.redirect(302, CONTRIBUTOR_PATH));

app.get('/health', (_req, res) => {
    res.json({
        ok: true,
        blogReady,
        uptimeSec: Math.floor(process.uptime()),
        now: new Date().toISOString(),
        lastScrapeTime: lastScrapeTime ? new Date(lastScrapeTime).toISOString() : null
    });
});

app.get('/sitemap.xml', async (_req, res) => {
    const siteBase = String(process.env.SITE_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const staticPaths = ['/', '/tin-tuc', ADMIN_PATH, CONTRIBUTOR_PATH];
    let postPaths = [];
    if (blogReady) {
        const posts = await BlogPost.find({ status: 'published' }).select('slug updatedAt').lean();
        postPaths = posts.map((p) => ({
            loc: `/tin-tuc/${encodeURIComponent(p.slug)}`,
            lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString() : null
        }));
    }

    const urls = [
        ...staticPaths.map((loc) => ({ loc, lastmod: null })),
        ...postPaths
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((item) => `  <url><loc>${escapeXml(siteBase + item.loc)}</loc>${item.lastmod ? `<lastmod>${escapeXml(item.lastmod)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.send(xml);
});

app.get('/rss.xml', async (_req, res) => {
    const siteBase = String(process.env.SITE_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const channelTitle = 'Bóng Đá Ngoại Hạng';
    const channelLink = `${siteBase}/tin-tuc`;
    const posts = blogReady
        ? await BlogPost.find({ status: 'published' })
            .sort({ publishedAt: -1, createdAt: -1 })
            .limit(20)
            .select('title slug excerpt contentHtml publishedAt createdAt')
            .lean()
        : [];

    const items = posts.map((p) => {
        const link = `${siteBase}/tin-tuc/${encodeURIComponent(p.slug)}`;
        const pubDate = new Date(p.publishedAt || p.createdAt || Date.now()).toUTCString();
        const description = sanitizePlainText(p.excerpt || p.contentHtml, { max: 220 });
        return `<item>
  <title>${escapeXml(p.title)}</title>
  <link>${escapeXml(link)}</link>
  <guid>${escapeXml(link)}</guid>
  <pubDate>${escapeXml(pubDate)}</pubDate>
  <description>${escapeXml(description)}</description>
</item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(channelTitle)}</title>
  <link>${escapeXml(channelLink)}</link>
  <description>${escapeXml('Tin tức bóng đá mới nhất và dữ liệu cập nhật liên tục.')}</description>
  <language>vi-VN</language>
${items}
</channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    return res.send(xml);
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
    if (!blogReady) return blogNotReady(res);
    const email = sanitizePlainText(req.body?.email, { max: 160, allowEmpty: false }).toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc.' });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Sai email hoặc mật khẩu.' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Sai email hoặc mật khẩu.' });
    const token = signToken(user);
    return res.json({
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
});

app.post('/api/auth/users', authRequired, roleRequired('admin'), async (req, res) => {
    if (!blogReady) return blogNotReady(res);
    const name = sanitizePlainText(req.body?.name, { max: 120, allowEmpty: false });
    const email = sanitizePlainText(req.body?.email, { max: 160, allowEmpty: false }).toLowerCase();
    const password = String(req.body?.password || '');
    const role = req.body?.role === 'admin' ? 'admin' : 'contributor';
    if (!name || !email || password.length < 6) {
        return res.status(400).json({ error: 'Dữ liệu không hợp lệ (mật khẩu tối thiểu 6 ký tự).' });
    }
    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ error: 'Email đã tồn tại.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role });
    return res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

app.get('/api/auth/users', authRequired, roleRequired('admin'), async (req, res) => {
    const users = await User.find({})
        .sort({ createdAt: -1 })
        .select('_id name email role isActive createdAt updatedAt')
        .lean();
    return res.json(users);
});

app.patch('/api/auth/users/:id', authRequired, roleRequired('admin'), async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });

    if (req.body?.role && ['admin', 'contributor'].includes(req.body.role)) {
        user.role = req.body.role;
    }
    if (typeof req.body?.isActive === 'boolean') {
        user.isActive = req.body.isActive;
    }
    if (typeof req.body?.password === 'string' && req.body.password.trim().length >= 6) {
        user.passwordHash = await bcrypt.hash(req.body.password.trim(), 10);
    }

    await user.save();
    return res.json({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
    });
});

app.get('/api/blog/posts', async (req, res) => {
    if (!blogReady) return blogNotReady(res);
    const status = req.query.status || 'published';
    const cacheKey = `blog-posts:${status}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    const filter = {};
    if (status !== 'all') filter.status = status;
    const posts = await BlogPost.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .select('title slug excerpt coverImage category tags authorName status publishedAt createdAt updatedAt')
        .lean();
    return res.json(setCached(cacheKey, posts));
});

app.get('/api/blog/admin/posts', authRequired, roleRequired('admin'), async (req, res) => {
    const status = String(req.query.status || 'all');
    const q = String(req.query.q || '').trim().toLowerCase();
    const filter = {};
    if (status !== 'all') filter.status = status;
    const posts = await BlogPost.find(filter)
        .sort({ updatedAt: -1 })
        .lean();
    const searched = q
        ? posts.filter((p) => p.title.toLowerCase().includes(q) || p.authorName.toLowerCase().includes(q))
        : posts;
    return res.json(searched);
});

app.get('/api/blog/posts/:slug', async (req, res) => {
    if (!blogReady) return blogNotReady(res);
    const slug = sanitizePlainText(req.params.slug, { max: 180, allowEmpty: false });
    const cacheKey = `blog-post:${slug}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);
    const post = await BlogPost.findOne({ slug }).lean();
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
    return res.json(setCached(cacheKey, post));
});

app.get('/api/blog/me/posts', authRequired, async (req, res) => {
    const filter = req.user.role === 'admin' ? {} : { authorId: req.user._id };
    const posts = await BlogPost.find(filter).sort({ updatedAt: -1 }).lean();
    return res.json(posts);
});

app.post('/api/blog/posts', authRequired, roleRequired('admin', 'contributor'), async (req, res) => {
    const title = sanitizePlainText(req.body?.title, { max: 200, allowEmpty: false });
    const contentHtml = sanitizeHtml(req.body?.contentHtml);
    if (!title || !contentHtml) return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung.' });
    const excerpt = sanitizePlainText(req.body?.excerpt, { max: 280 });
    const coverImage = sanitizePlainText(req.body?.coverImage, { max: 300 });
    const category = sanitizePlainText(req.body?.category || 'Tin tức', { max: 80, allowEmpty: false });
    const tags = Array.isArray(req.body?.tags)
        ? req.body.tags.map((x) => sanitizePlainText(x, { max: 32 })).filter(Boolean).slice(0, 8)
        : [];
    const requestedStatus = String(req.body?.status || '').trim();
    const status = req.user.role === 'admin'
        ? (requestedStatus || 'draft')
        : (requestedStatus === 'published' ? 'pending' : (requestedStatus || 'pending'));
    const slug = await ensureUniqueSlug(req.body?.slug || title);
    const publishedAt = status === 'published' ? new Date() : null;
    const post = await BlogPost.create({
        title,
        slug,
        excerpt,
        contentHtml,
        coverImage,
        category,
        tags,
        status,
        authorId: req.user._id,
        authorName: req.user.name,
        publishedAt
    });
    clearCacheByPrefix('blog-posts:');
    clearCacheByPrefix('blog-post:');
    return res.status(201).json(post);
});

app.put('/api/blog/posts/:id', authRequired, roleRequired('admin', 'contributor'), async (req, res) => {
    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
    const isOwner = post.authorId.toString() === req.user._id.toString();
    if (req.user.role !== 'admin' && !isOwner) return res.status(403).json({ error: 'Bạn không thể sửa bài này.' });

    const nextTitle = sanitizePlainText(req.body?.title || post.title, { max: 200, allowEmpty: false });
    const nextContent = sanitizeHtml(req.body?.contentHtml || post.contentHtml);
    post.title = nextTitle;
    post.contentHtml = nextContent;
    post.excerpt = sanitizePlainText(req.body?.excerpt ?? post.excerpt, { max: 280 });
    post.coverImage = sanitizePlainText(req.body?.coverImage ?? post.coverImage, { max: 300 });
    post.category = sanitizePlainText(req.body?.category ?? post.category, { max: 80, allowEmpty: false });
    post.tags = Array.isArray(req.body?.tags)
        ? req.body.tags.map((x) => sanitizePlainText(x, { max: 32 })).filter(Boolean).slice(0, 8)
        : post.tags;
    post.slug = await ensureUniqueSlug(req.body?.slug || nextTitle, post._id);

    if (req.user.role === 'admin') {
        const status = String(req.body?.status || post.status).trim();
        post.status = ['draft', 'pending', 'published'].includes(status) ? status : post.status;
        post.publishedAt = post.status === 'published' ? (post.publishedAt || new Date()) : null;
    } else {
        post.status = post.status === 'published' ? 'published' : 'pending';
    }

    await post.save();
    clearCacheByPrefix('blog-posts:');
    clearCacheByPrefix('blog-post:');
    return res.json(post);
});

app.post('/api/blog/posts/:id/publish', authRequired, roleRequired('admin'), async (req, res) => {
    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
    post.status = 'published';
    post.publishedAt = new Date();
    await post.save();
    clearCacheByPrefix('blog-posts:');
    clearCacheByPrefix('blog-post:');
    return res.json(post);
});

app.delete('/api/blog/posts/:id', authRequired, roleRequired('admin'), async (req, res) => {
    const post = await BlogPost.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
    clearCacheByPrefix('blog-posts:');
    clearCacheByPrefix('blog-post:');
    return res.json({ ok: true });
});

async function scrapeFromUrl({ url, leagueNameFallback }) {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 15000
    });

    const $ = cheerio.load(data);
    const resultMatches = [];

    $('.cate-24h-foot-box-sche-table-ring').each((i, section) => {
        let titleRaw = $(section).find('h2.tuht_show').text().trim();
        let leagueName = leagueNameFallback || 'Unknown';
        let roundName = titleRaw.replace(/lịch thi đấu\s*/i, '').trim() || 'Không rõ vòng';
        if (titleRaw.includes('-')) {
            const parts = titleRaw.split('-');
            roundName = parts[0].replace(/lịch thi đấu\s*/i, '').trim();
            leagueName = parts[1].trim();
        } else if (!titleRaw.toLowerCase().includes('vòng')) {
            leagueName = titleRaw;
            roundName = 'Vòng loại';
        }

        $(section).find('article.cate-24h-foot-box-sche-table').each((j, article) => {
            const domDate = $(article).find('header.cate-24h-foot-box-sche-table__title span').text().trim();
            let matchDate = domDate;

            const regexDate = domDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (regexDate) {
               matchDate = `${regexDate[1]}/${regexDate[2]}/${regexDate[3]}`;
            }

            $(article).find('li[class*="mid"]').each((k, li) => {
                const timeRaw = $(li).find('.cate-24h-foot-home-sche-content__time strong').text().trim();
                const matchTime = timeRaw.split(' ')[0] || timeRaw;

                const homeTeamName = $(li).find('.cate-24h-foot-home-sche-content__match--left figcaption span').text().trim();
                const awayTeamName = $(li).find('.cate-24h-foot-home-sche-content__match--right figcaption span').text().trim();
                const homeLogoUrl = $(li).find('.cate-24h-foot-home-sche-content__match--left img').attr('src') || '';
                const awayLogoUrl = $(li).find('.cate-24h-foot-home-sche-content__match--right img').attr('src') || '';

                const scoreA = $(li).find('.match-fs_a').text().trim();
                const scoreB = $(li).find('.match-fs_b').text().trim();
                let scoreStr = '';
                if (scoreA !== '' && scoreB !== '') {
                    scoreStr = `${scoreA} - ${scoreB}`;
                }

                if (homeTeamName && awayTeamName) {
                    resultMatches.push({
                        league: leagueName,
                        round: roundName,
                        date: matchDate,
                        time: matchTime,
                        score: scoreStr,
                        homeTeam: homeTeamName,
                        awayTeam: awayTeamName,
                        homeLogo: homeLogoUrl,
                        awayLogo: awayLogoUrl
                    });
                }
            });
        });
    });

    return resultMatches;
}

async function scrape24hSchedule() {
    console.log("-> Bắt đầu scraping 24h.com.vn (multi-league)...");

    const buckets = await Promise.allSettled(
        LEAGUE_SCHEDULES.map((l) => scrapeFromUrl({ url: l.url, leagueNameFallback: l.name }))
    );

    const matches = buckets
        .filter((b) => b.status === 'fulfilled')
        .flatMap((b) => b.value);

    console.log(`-> Đã cào được ${matches.length} trận đấu!`);

    if (matches.length === 0) {
        const mock = readMockMatches();
        if (mock.length) {
            console.log(`-> Fallback: dùng mock ${mock.length} trận từ public_api_data.json`);
            return mock;
        }
    }

    return matches;
}

async function refreshMatchesCache(reason = 'scheduled') {
    if (isScraping) {
        console.log(`[SCRAPER] Bỏ qua job "${reason}" vì đang có phiên cào khác.`);
        return;
    }

    isScraping = true;
    console.log(`[SCRAPER] Bắt đầu job "${reason}"...`);
    try {
        const freshMatches = await scrape24hSchedule();
        if (freshMatches.length > 0) {
            globalMatchesCache = freshMatches;
            lastScrapeTime = Date.now();
            writeMatchesCache(freshMatches);
            console.log(`[SCRAPER] Hoàn tất job "${reason}". Tổng trận: ${freshMatches.length}`);
            return;
        }
        console.warn(`[SCRAPER] Job "${reason}" không có dữ liệu mới, giữ cache cũ.`);
    } catch (err) {
        console.error(`[SCRAPER] Job "${reason}" lỗi:`, err.message);
    } finally {
        isScraping = false;
    }
}

function setupScrapeScheduler() {
    if (SCRAPE_ON_STARTUP) {
        refreshMatchesCache('startup');
    }
    setInterval(() => {
        refreshMatchesCache('scheduled-interval');
    }, SCRAPE_INTERVAL_MS);
}

app.get('/api/matches', (req, res) => {
    if (!globalMatchesCache) {
        globalMatchesCache = readMockMatches();
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (lastScrapeTime) {
        res.setHeader('X-Last-Scrape-Time', new Date(lastScrapeTime).toISOString());
    }
    return res.send(JSON.stringify(globalMatchesCache || []));
});

app.get('/api/standings', (req, res) => {
    try {
        const cached = getCached('standings:raw');
        if (cached) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.send(cached);
        }
        const standingsPath = path.join(PUBLIC_DIR, 'public_standings_data.json');
        const raw = fs.readFileSync(standingsPath, 'utf-8');
        setCached('standings:raw', raw, CACHE_TTL_MS);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.send(raw);
    } catch (err) {
        console.error('Standings read error:', err.message);
        return res.status(500).json({ error: 'Không thể tải BXH' });
    }
});

app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    globalMatchesCache = readMockMatches();
    setupScrapeScheduler();
    connectMongo().then(seedAdminAccount);

    console.log(`=====================================`);
    console.log(`[API START] Backend Express.js Server`);
    console.log(`Lắng nghe tại http://localhost:${PORT}`);
    console.log(`Test endpoint JSON: http://localhost:${PORT}/api/matches`);
    console.log(`Scrape interval: ${SCRAPE_INTERVAL_MS}ms`);
    console.log(`Scrape on startup: ${SCRAPE_ON_STARTUP ? 'ON' : 'OFF'}`);
    console.log(`=====================================`);
});
