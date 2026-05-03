const state = {
  posts: [],
  activeCat: 'all',
  banners: [],
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtToday() {
  const d = new Date();
  return d.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function plainExcerpt(html, limit = 170) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return text.slice(0, limit).replace(/\s+\S*$/, '') + '…';
}

function readingTime(html) {
  const words = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));
  return `${minutes} phút đọc`;
}

function heroTemplate(post) {
  const excerpt = escapeHtml(post.excerpt || plainExcerpt(post.contentHtml));
  const href = `/tin-tuc/${encodeURIComponent(post.slug)}`;
  const cat = escapeHtml(post.category || 'Tin tức');
  const cover = post.coverImage
    ? `<img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.title)}" />`
    : '';
  return `
    <div class="mag-hero-media">
      ${cover}
      <span class="mag-hero-badge">Bài nổi bật</span>
    </div>
    <div class="mag-hero-body">
      <div class="mag-hero-cat">${cat}</div>
      <h2 class="mag-hero-title"><a href="${href}">${escapeHtml(post.title)}</a></h2>
      <p class="mag-hero-excerpt">${excerpt}</p>
      <div class="mag-hero-meta">
        <span>${fmtDate(post.publishedAt || post.createdAt)}</span>
        <span class="dot"></span>
        <span>${readingTime(post.contentHtml)}</span>
      </div>
    </div>
  `;
}

function cardTemplate(post) {
  const excerpt = escapeHtml(post.excerpt || plainExcerpt(post.contentHtml, 140));
  const href = `/tin-tuc/${encodeURIComponent(post.slug)}`;
  const cat = escapeHtml(post.category || 'Tin tức');
  return `
    <article class="mag-card">
      <div class="mag-card-cat">${cat}</div>
      <h3 class="mag-card-title"><a href="${href}">${escapeHtml(post.title)}</a></h3>
      <p class="mag-card-excerpt">${excerpt}</p>
      <div class="mag-card-meta">${fmtDate(post.publishedAt || post.createdAt)} · ${readingTime(post.contentHtml)}</div>
    </article>
  `;
}

function rowTemplate(post) {
  const excerpt = escapeHtml(post.excerpt || plainExcerpt(post.contentHtml, 150));
  const href = `/tin-tuc/${encodeURIComponent(post.slug)}`;
  const cat = escapeHtml(post.category || 'Tin tức');
  const thumb = post.coverImage
    ? `<img src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.title)}" />`
    : `<span class="mag-row-thumb-ph">${cat}</span>`;
  return `
    <article class="mag-row">
      <a class="mag-row-thumb" href="${href}" aria-hidden="true" tabindex="-1">${thumb}</a>
      <div class="mag-row-body">
        <div class="mag-row-cat">${cat}</div>
        <h3 class="mag-row-title"><a href="${href}">${escapeHtml(post.title)}</a></h3>
        <p class="mag-row-excerpt">${excerpt}</p>
      </div>
      <div class="mag-row-meta">${fmtDate(post.publishedAt || post.createdAt)} · ${readingTime(post.contentHtml)}</div>
    </article>
  `;
}

function render() {
  const hero = document.getElementById('heroSection');
  const grid = document.getElementById('featuredGrid');
  const list = document.getElementById('latestList');
  const empty = document.getElementById('emptyState');

  const filtered =
    state.activeCat === 'all'
      ? state.posts
      : state.posts.filter((p) => (p.category || '').trim() === state.activeCat);

  if (!filtered.length) {
    hero.innerHTML = '';
    grid.innerHTML = '';
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const [lead, ...rest] = filtered;
  hero.innerHTML = heroTemplate(lead);

  const featured = rest.slice(0, 3);
  grid.innerHTML = featured.map(cardTemplate).join('');

  const latest = rest.slice(3);
  list.innerHTML = latest.length
    ? latest.map(rowTemplate).join('')
    : '<div class="mag-empty">Chưa có thêm bài viết mới.</div>';
}

function renderBanners() {
  const items = Array.isArray(state.banners) ? state.banners.slice(0, 2) : [];
  for (let i = 0; i < 2; i += 1) {
    const item = items[i] || {};
    const linkEl = document.getElementById(`newsBannerLink${i + 1}`);
    const imgEl = document.getElementById(`newsBannerImg${i + 1}`);
    if (!linkEl || !imgEl) continue;
    const targetUrl = item.targetUrl || '#';
    const imageUrl = item.imageUrl || '';
    linkEl.href = targetUrl;
    linkEl.setAttribute('aria-label', `Quảng cáo ${i + 1}`);
    imgEl.src = imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22480%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%23121f37%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%239aa6bd%22 font-family=%22Arial%22 font-size=%2222%22%3EQuang cao%3C/text%3E%3C/svg%3E';
  }
}

function bindCatNav() {
  const nav = document.getElementById('catNav');
  if (!nav) return;
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.mag-cat');
    if (!btn) return;
    const cat = btn.dataset.cat || 'all';
    state.activeCat = cat;
    nav.querySelectorAll('.mag-cat').forEach((b) => b.classList.toggle('active', b === btn));
    render();
  });
}

function setHeaderMeta() {
  const today = document.getElementById('magToday');
  if (today) today.textContent = fmtToday();
  const year = document.getElementById('yearNow');
  if (year) year.textContent = String(new Date().getFullYear());
}

async function boot() {
  setHeaderMeta();
  bindCatNav();
  try {
    const [postRes, bannerRes] = await Promise.all([
      fetch('/api/blog/posts?status=published'),
      fetch('/api/system/news-banners'),
    ]);
    const postPayload = await postRes.json();
    const bannerPayload = await bannerRes.json();
    state.posts = Array.isArray(postPayload) ? postPayload : Array.isArray(postPayload.data) ? postPayload.data : [];
    state.banners = Array.isArray(bannerPayload) ? bannerPayload : Array.isArray(bannerPayload.data) ? bannerPayload.data : [];
    renderBanners();
    render();
  } catch (err) {
    const hero = document.getElementById('heroSection');
    hero.innerHTML = `<div class="mag-empty">Không thể tải tin tức: ${escapeHtml(err.message)}</div>`;
  }
}

boot();
