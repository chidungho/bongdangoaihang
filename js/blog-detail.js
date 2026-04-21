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

function readingTime(html) {
  const words = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));
  return `${minutes} phút đọc`;
}

function getSlug() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[1] || '';
}

async function loadPost() {
  const slug = getSlug();
  const res = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('Bài viết không tồn tại');
  const post = await res.json();

  document.title = `${post.title} | Bóng Đá Ngoại Hạng`;

  const category = post.category || 'Tin tức';
  const crumb = document.getElementById('crumbCategory');
  if (crumb) crumb.textContent = category;

  const cat = document.getElementById('articleCategory');
  if (cat) cat.textContent = category;

  document.getElementById('title').textContent = post.title;

  const excerptEl = document.getElementById('excerpt');
  if (post.excerpt) {
    excerptEl.textContent = post.excerpt;
  } else {
    excerptEl.remove();
  }

  document.getElementById('meta').innerHTML = `
    <span>${escapeHtml(post.authorName || 'Bóng Đá Ngoại Hạng')}</span>
    <span>·</span>
    <span>${fmtDate(post.publishedAt || post.createdAt)}</span>
    <span>·</span>
    <span>${readingTime(post.contentHtml)}</span>
  `;

  const coverFigure = document.getElementById('coverFigure');
  const cover = document.getElementById('cover');
  if (post.coverImage) {
    cover.src = post.coverImage;
    cover.alt = post.title;
  } else {
    coverFigure.classList.add('hidden');
  }

  document.getElementById('content').innerHTML = post.contentHtml || '';

  const year = document.getElementById('yearNow');
  if (year) year.textContent = String(new Date().getFullYear());
}

loadPost().catch((err) => {
  document.getElementById('content').innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  const year = document.getElementById('yearNow');
  if (year) year.textContent = String(new Date().getFullYear());
});
