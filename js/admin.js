const $ = (id) => document.getElementById(id);
const tokenKey = 'bdnh_admin_token';
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
    users: ['tabUsers', 'usersSection'],
    moderation: ['tabModeration', 'moderationSection'],
    blog: ['tabBlog', 'blogSection'],
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
  if (data.user.role !== 'admin') throw new Error('Tài khoản không phải admin');
  token = data.token;
  localStorage.setItem(tokenKey, token);
  showDashboard();
  switchTab('overview');
  await Promise.all([loadPosts(), loadUsers(), loadModeration()]);
}

function payloadFromForm() {
  return {
    title: $('title').value,
    slug: $('slug').value,
    coverImage: $('coverImage').value,
    category: $('category').value,
    tags: $('tags').value.split(',').map((x) => x.trim()).filter(Boolean),
    excerpt: $('excerpt').value,
    contentHtml: editor.root.innerHTML,
    status: $('status').value,
  };
}

async function createPost() {
  const res = await fetch('/api/blog/posts', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payloadFromForm()),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không tạo được bài');
  alert('Đã lưu bài viết.');
  await loadPosts();
}

async function createUser() {
  const payload = {
    name: $('newUserName').value.trim(),
    email: $('newUserEmail').value.trim(),
    password: $('newUserPassword').value,
    role: $('newUserRole').value,
  };
  const res = await fetch('/api/auth/users', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không tạo được tài khoản');
  alert(`Đã tạo tài khoản ${data.email}`);
  $('newUserName').value = '';
  $('newUserEmail').value = '';
  $('newUserPassword').value = '';
  $('newUserRole').value = 'contributor';
  await loadUsers();
}

async function publishPost(id) {
  const res = await fetch(`/api/blog/posts/${id}/publish`, { method: 'POST', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không publish được');
  await loadPosts();
}

async function deletePost(id) {
  if (!confirm('Xóa bài viết này?')) return;
  const res = await fetch(`/api/blog/posts/${id}`, { method: 'DELETE', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không xóa được');
  await loadPosts();
}

async function loadUsers() {
  const res = await fetch('/api/auth/users', { headers: authHeaders() });
  const users = await res.json();
  if (!res.ok) throw new Error(users.error || 'Không tải được tài khoản');
  $('userRows').innerHTML = users
    .map(
      (u) => `<tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${u.isActive ? 'Hoạt động' : 'Đã khóa'}</td>
        <td>
          <a class="inline" href="#" data-role="${u._id}" data-next-role="${u.role === 'admin' ? 'contributor' : 'admin'}">Đổi vai trò</a>
          •
          <a class="inline" href="#" data-toggle="${u._id}" data-active="${u.isActive ? '1' : '0'}">${u.isActive ? 'Khóa' : 'Mở khóa'}</a>
        </td>
      </tr>`,
    )
    .join('');
}

async function updateUser(userId, payload) {
  const res = await fetch(`/api/auth/users/${userId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không cập nhật được user');
  await loadUsers();
}

async function loadModeration() {
  const status = $('moderationStatusFilter').value;
  const q = encodeURIComponent(($('moderationSearch').value || '').trim());
  const res = await fetch(`/api/blog/admin/posts?status=${encodeURIComponent(status)}&q=${q}`, {
    headers: authHeaders(),
  });
  const posts = await res.json();
  if (!res.ok) throw new Error(posts.error || 'Không tải được danh sách duyệt');
  $('moderationRows').innerHTML = posts
    .map(
      (p) => `<tr>
        <td>${p.title}</td>
        <td>${p.authorName}</td>
        <td>${p.status}</td>
        <td>${new Date(p.updatedAt).toLocaleString('vi-VN')}</td>
        <td>
          <a class="inline" href="#" data-set-status="${p._id}" data-status="published">Xuất bản</a>
          •
          <a class="inline" href="#" data-set-status="${p._id}" data-status="pending">Chờ duyệt</a>
          •
          <a class="inline" href="#" data-set-status="${p._id}" data-status="draft">Nháp</a>
        </td>
      </tr>`,
    )
    .join('');
}

async function setPostStatus(postId, status) {
  const res = await fetch(`/api/blog/posts/${postId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không cập nhật được trạng thái bài');
  await Promise.all([loadPosts(), loadModeration()]);
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

  $('postRows').innerHTML = data
    .map(
      (p) => `<tr>
        <td>${p.title}</td>
        <td>${p.status}</td>
        <td>${p.authorName}</td>
        <td>${new Date(p.updatedAt).toLocaleString('vi-VN')}</td>
        <td>
          ${p.status !== 'published' ? `<a class="inline" href="#" data-publish="${p._id}">Publish</a> • ` : ''}
          <a class="inline" href="#" data-delete="${p._id}">Xóa</a>
        </td>
      </tr>`,
    )
    .join('');
}

$('loginBtn').addEventListener('click', () => login().catch((e) => alert(e.message)));
$('saveBtn').addEventListener('click', () => createPost().catch((e) => alert(e.message)));
$('createUserBtn').addEventListener('click', () => createUser().catch((e) => alert(e.message)));
$('tabOverview').addEventListener('click', () => switchTab('overview'));
$('tabUsers').addEventListener('click', () => switchTab('users'));
$('tabModeration').addEventListener('click', () => switchTab('moderation'));
$('tabBlog').addEventListener('click', () => switchTab('blog'));
$('reloadModerationBtn').addEventListener('click', () => loadModeration().catch((e) => alert(e.message)));
$('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});

$('userRows').addEventListener('click', (e) => {
  const roleId = e.target.getAttribute('data-role');
  const nextRole = e.target.getAttribute('data-next-role');
  const toggleId = e.target.getAttribute('data-toggle');
  const activeFlag = e.target.getAttribute('data-active');
  if (roleId && nextRole) {
    e.preventDefault();
    updateUser(roleId, { role: nextRole }).catch((err) => alert(err.message));
  }
  if (toggleId) {
    e.preventDefault();
    updateUser(toggleId, { isActive: activeFlag !== '1' }).catch((err) => alert(err.message));
  }
});

$('moderationRows').addEventListener('click', (e) => {
  const postId = e.target.getAttribute('data-set-status');
  const status = e.target.getAttribute('data-status');
  if (!postId || !status) return;
  e.preventDefault();
  setPostStatus(postId, status).catch((err) => alert(err.message));
});

$('postRows').addEventListener('click', (e) => {
  const publishId = e.target.getAttribute('data-publish');
  const deleteId = e.target.getAttribute('data-delete');
  if (publishId) {
    e.preventDefault();
    publishPost(publishId).catch((err) => alert(err.message));
  }
  if (deleteId) {
    e.preventDefault();
    deletePost(deleteId).catch((err) => alert(err.message));
  }
});

if (token) {
  showDashboard();
  switchTab('overview');
  Promise.all([loadPosts(), loadUsers(), loadModeration()]).catch(() => {});
} else {
  showLogin();
}
