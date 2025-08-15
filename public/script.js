const API_BASE = '';

const els = {
  tabLogin: document.getElementById('tabLogin'),
  tabRegister: document.getElementById('tabRegister'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  authStatus: document.getElementById('authStatus'),
  logoutBtn: document.getElementById('logoutBtn'),

  loginId: document.getElementById('loginId'),
  loginPassword: document.getElementById('loginPassword'),
  loginBtn: document.getElementById('loginBtn'),

  regUsername: document.getElementById('regUsername'),
  regEmail: document.getElementById('regEmail'),
  regPassword: document.getElementById('regPassword'),
  registerBtn: document.getElementById('registerBtn'),

  composer: document.getElementById('composer'),
  postText: document.getElementById('postText'),
  postAnonymous: document.getElementById('postAnonymous'),
  postBtn: document.getElementById('postBtn'),
  postMsg: document.getElementById('postMsg'),

  tabFeed: document.getElementById('tabFeed'),
  tabMine: document.getElementById('tabMine'),
  feed: document.getElementById('feed'),
  mine: document.getElementById('mine')
};

function token() { return localStorage.getItem('jwt'); }
function setToken(t) { t ? localStorage.setItem('jwt', t) : localStorage.removeItem('jwt'); }

function setLoggedInUI(user) {
  els.authStatus.textContent = user ? `Logged in as ${user.username}` : '';
  els.logoutBtn.classList.toggle('hidden', !user);
  els.composer.classList.toggle('hidden', !user);
}

async function me() {
  const t = token();
  if (!t) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` }});
    if (!res.ok) throw 0;
    const data = await res.json();
    return data.user;
  } catch { return null; }
}

// ----- Tabs
els.tabLogin.onclick = () => {
  els.tabLogin.classList.add('active'); els.tabRegister.classList.remove('active');
  els.loginForm.classList.remove('hidden'); els.registerForm.classList.add('hidden');
};
els.tabRegister.onclick = () => {
  els.tabRegister.classList.add('active'); els.tabLogin.classList.remove('active');
  els.registerForm.classList.remove('hidden'); els.loginForm.classList.add('hidden');
};

els.tabFeed.onclick = () => {
  els.tabFeed.classList.add('active'); els.tabMine.classList.remove('active');
  els.feed.classList.remove('hidden'); els.mine.classList.add('hidden');
};
els.tabMine.onclick = () => {
  els.tabMine.classList.add('active'); els.tabFeed.classList.remove('active');
  els.mine.classList.remove('hidden'); els.feed.classList.add('hidden');
  loadMine();
};

// ----- Auth
els.registerBtn.onclick = async () => {
  try {
    const body = {
      username: els.regUsername.value.trim(),
      email: els.regEmail.value.trim(),
      password: els.regPassword.value
    };
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Register failed');
    setToken(data.token);
    const user = await me();
    setLoggedInUI(user);
    els.authStatus.textContent = 'Account created!';
    loadFeed();
  } catch (e) {
    els.authStatus.textContent = e.message;
  }
};

els.loginBtn.onclick = async () => {
  try {
    const body = { emailOrUsername: els.loginId.value.trim(), password: els.loginPassword.value };
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setToken(data.token);
    const user = await me();
    setLoggedInUI(user);
    els.authStatus.textContent = 'Welcome back!';
    loadFeed();
    loadMine();
  } catch (e) {
    els.authStatus.textContent = e.message;
  }
};

els.logoutBtn.onclick = () => {
  setToken(null);
  setLoggedInUI(null);
};

// ----- Posts
els.postBtn.onclick = async () => {
  try {
    els.postMsg.textContent = 'Posting...';
    const body = {
      text: els.postText.value,
      anonymous: els.postAnonymous.checked
    };
    const res = await fetch(`${API_BASE}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Post failed');
    els.postText.value = '';
    els.postMsg.textContent = 'Posted!';
    loadFeed();
    loadMine();
  } catch (e) {
    els.postMsg.textContent = e.message;
  }
};

function renderPost(p, mineView=false) {
  const sentClass = p.sentiment === 'positive' ? 'sent-pos' : p.sentiment === 'negative' ? 'sent-neg' : 'sent-neu';
  const tags = (p.tags || []).map(t => `<span class="badge">${t}</span>`).join(' ');
  const when = new Date(p.createdAt).toLocaleString();
  const who = p.anonymous ? 'Anonymous' : (p.author || 'Unknown');

  let actions = '';
  if (mineView) {
    actions = `
      <div class="actions">
        <button onclick="editPost('${p.id}', '${encodeURIComponent(p.text)}', ${p.anonymous})">Edit</button>
        <button onclick="deletePost('${p.id}')">Delete</button>
      </div>
    `;
  }

  return `
    <div class="post">
      <div>${p.text.replace(/</g,'<')}</div>
      <div class="meta">
        <span class="badge ${'sent-'+p.sentiment[0]+p.sentiment.slice(1,3)} ${sentClass}">${p.sentiment}</span>
        ${tags}
        <span class="badge">${who}</span>
        <span class="badge">${when}</span>
      </div>
      ${actions}
    </div>
  `;
}

async function loadFeed() {
  const res = await fetch(`${API_BASE}/api/posts`, {
    headers: token() ? { Authorization: `Bearer ${token()}` } : {}
  });
  const data = await res.json();
  if (!Array.isArray(data)) { els.feed.textContent = 'Failed to load.'; return; }
  els.feed.innerHTML = data.map(p => renderPost(p, false)).join('') || 'No posts yet.';
}

async function loadMine() {
  if (!token()) { els.mine.innerHTML = 'Login to see your posts.'; return; }
  const res = await fetch(`${API_BASE}/api/my-posts`, {
    headers: { Authorization: `Bearer ${token()}` }
  });
  const data = await res.json();
  if (!Array.isArray(data)) { els.mine.textContent = 'Failed to load.'; return; }
  // augment for renderer
  const mine = data.map(p => ({ ...p, author: 'You' }));
  els.mine.innerHTML = mine.map(p => renderPost(p, true)).join('') || 'You have no posts.';
}

window.editPost = async function(id, encodedText, anonymous) {
  const current = decodeURIComponent(encodedText);
  const text = prompt('Edit your post:', current);
  if (text === null) return;
  const anon = confirm('Post anonymously? OK = Yes, Cancel = No');
  const res = await fetch(`${API_BASE}/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ text, anonymous: anon })
  });
  const out = await res.json();
  if (!res.ok) { alert(out.error || 'Update failed'); return; }
  loadFeed(); loadMine();
}

window.deletePost = async function(id) {
  if (!confirm('Delete this post?')) return;
  const res = await fetch(`${API_BASE}/api/posts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token()}` }
  });
  const out = await res.json();
  if (!res.ok) { alert(out.error || 'Delete failed'); return; }
  loadFeed(); loadMine();
}

// init
(async () => {
  const user = await me();
  setLoggedInUI(user);
  loadFeed();
})();
