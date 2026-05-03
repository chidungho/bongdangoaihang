const $ = (id) => document.getElementById(id);
const tokenKey = 'bdnh_contributor_token';
let token = localStorage.getItem(tokenKey) || '';
let editor = null;

function authHeaders() {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function showDashboard() {
  $('loginPanel').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
  if (!editor) editor = new Quill('#editor', { theme: 'snow' });
}

function showLogin() {
  $('dashboard').classList.add('hidden');
  $('loginPanel').classList.remove('hidden');
}

function logout() {
  token = '';
  localStorage.removeItem(tokenKey);
  showLogin();
}

function switchTab(tab) {
  const map = {
    overview: ['tabOverview', 'overviewSection'],
    compose: ['tabCompose', 'composeSection'],
    posts: ['tabPosts', 'postsSection'],
  };
  Object.values(map).forEach(([tabId, sectionId]) => {
    $(tabId).classList.remove('active');
    $(sectionId).classList.add('hidden');
  });
  if (!map[tab]) return;
  const [tabId, sectionId] = map[tab];
  $(tabId).classList.add('active');
  $(sectionId).classList.remove('hidden');
}

async function login() {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: $('email').value, password: $('password').value }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');
  if (data.user.role !== 'contributor') throw new Error('Trang này chỉ dành cho tài khoản cộng tác viên.');
  token = data.token;
  localStorage.setItem(tokenKey, token);
  showDashboard();
  switchTab('overview');
  await loadPosts();
}

async function createPost() {
  const payload = {
    title: $('title').value,
    slug: $('slug').value,
    coverImage: $('coverImage').value,
    category: $('category').value,
    tags: $('tags').value.split(',').map((x) => x.trim()).filter(Boolean),
    excerpt: $('excerpt').value,
    contentHtml: editor.root.innerHTML,
    status: 'pending',
  };
  const res = await fetch('/api/blog/posts', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không gửi được bài');
  alert('Đã gửi bài chờ duyệt.');
  $('title').value = '';
  $('slug').value = '';
  $('coverImage').value = '';
  $('tags').value = '';
  $('excerpt').value = '';
  editor.setContents([]);
  await loadPosts();
}

async function loadPosts() {
  const res = await fetch('/api/blog/me/posts', { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không tải được danh sách');
  const total = data.length;
  const published = data.filter((p) => p.status === 'published').length;
  const pending = data.filter((p) => p.status === 'pending').length;
  const draft = data.filter((p) => p.status === 'draft').length;
  $('statTotal').textContent = total;
  $('statPublished').textContent = published;
  $('statPending').textContent = pending;
  $('statDraft').textContent = draft;

  const filter = $('myStatusFilter').value;
  const list = filter === 'all' ? data : data.filter((p) => p.status === filter);
  $('postRows').innerHTML = list
    .map(
      (p) => `<tr>
        <td>${p.title}</td>
        <td>${p.status}</td>
        <td>${new Date(p.updatedAt).toLocaleString('vi-VN')}</td>
      </tr>`,
    )
    .join('');
}

$('loginBtn').addEventListener('click', () => login().catch((e) => alert(e.message)));
$('saveBtn').addEventListener('click', () => createPost().catch((e) => alert(e.message)));
$('tabOverview').addEventListener('click', () => switchTab('overview'));
$('tabCompose').addEventListener('click', () => switchTab('compose'));
$('tabPosts').addEventListener('click', () => switchTab('posts'));
$('reloadMyPostsBtn').addEventListener('click', () => loadPosts().catch((e) => alert(e.message)));
$('myStatusFilter').addEventListener('change', () => loadPosts().catch((e) => alert(e.message)));
$('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});

if (token) {
  showDashboard();
  switchTab('overview');
  loadPosts().catch(() => {});
} else {
  showLogin();
}
