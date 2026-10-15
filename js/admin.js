(function () {
  const STORAGE_KEY = 'sdit_di_site_data_v1';
  const DATA_URL = '../data/site.json';
  let data = null;
  let lastParsed = null;
  let editCtx = null; // { type, index }

  const $ = (id) => document.getElementById(id);
  const status = (msg) => {
    const s = $('status');
    if (!s) return;
    const now = new Date();
    const ts = now.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
    s.innerHTML = `<strong>${msg}</strong> <span style="opacity:.75;font-weight:500">· ${ts}</span>`;
    s.classList.add('flash');
    clearTimeout(status._t);
    status._t = setTimeout(() => s.classList.remove('flash'), 2500);
  };
  const cfg = () => window.SDIT_CONFIG || {};

  // --- Auth ---
  const AUTH_KEY = 'sdit_di_admin_auth_v1';
  const TOKEN_KEY = 'sdit_di_admin_token_v1';

  function isAuthed() {
    try { return sessionStorage.getItem(AUTH_KEY) === '1' && !!sessionStorage.getItem(TOKEN_KEY); } catch (_) { return false; }
  }

  function getSessionToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
  }

  function setSession(token) {
    try {
      sessionStorage.setItem(AUTH_KEY, '1');
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
    } catch (_) {}
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('sdit_di_ppdb_focus');
    } catch (_) {}
  }

  function unlockAdmin() {
    document.body.classList.remove('admin-locked');
    const login = document.getElementById('adminLogin');
    const app = document.getElementById('adminApp');
    if (login) {
      login.classList.add('hidden');
      login.style.display = 'none';
    }
    if (app) {
      app.classList.remove('locked');
      app.style.display = '';
    }
    status('Berhasil masuk panel admin.');
  }

  function lockAdmin() {
    document.body.classList.add('admin-locked');
    const login = document.getElementById('adminLogin');
    const app = document.getElementById('adminApp');
    if (login) {
      login.classList.remove('hidden');
      login.style.display = '';
    }
    if (app) {
      app.classList.add('locked');
    }
  }

  function grantAuth(token) {
    setSession(token);
    unlockAdmin();
  }

  async function tryLogin() {
    const input = document.getElementById('loginPass');
    const pass = (input && input.value != null) ? String(input.value).trim() : '';
    const err = document.getElementById('loginErr');
    const conf = cfg();
    if (!pass) {
      if (err) err.textContent = 'Masukkan password.';
      return;
    }
    if (!conf.sheetsApiUrl) {
      if (err) err.textContent = 'sheetsApiUrl belum diisi di config.js';
      return;
    }
    if (err) err.textContent = 'Memverifikasi…';
    try {
      const res = await fetch(conf.sheetsApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'adminLogin', password: pass })
      });
      const j = await res.json();
      if (!j || !j.ok || !j.token) {
        if (err) err.textContent = (j && j.error) || 'Password salah.';
        status('Password salah atau server menolak.');
        if (input) { input.focus(); input.select(); }
        return;
      }
      if (err) err.textContent = '';
      grantAuth(j.token);
      if (input) input.value = '';
      status('Login berhasil. Selamat bekerja.');
      try { focusPpdbSectionIfNeeded(); } catch (_) {}
      try { loadPpdbList(); } catch (_) {}
    } catch (e) {
      if (err) err.textContent = 'Gagal menghubungi server: ' + (e.message || e);
      status('Gagal login: ' + (e.message || e));
    }
  }

  // Secret keystroke on login: Ctrl+Alt then type 9999
  let secretBuf = '';
  let secretArmed = false;
  document.addEventListener('keydown', (e) => {
    if (isAuthed()) return;
    // Arm when Ctrl+Alt held and a digit pressed, or track sequence
    if (e.ctrlKey && e.altKey) {
      const k = e.key;
      if (k >= '0' && k <= '9') {
        e.preventDefault();
        secretBuf += k;
        if (secretBuf.length > 4) secretBuf = secretBuf.slice(-4);
        if (secretBuf === '9999') {
          secretBuf = '';
          grantAuth();
          status('Masuk via keystroke rahasia.');
        }
      } else if (k === 'Control' || k === 'Alt') {
        // ignore
      } else {
        secretBuf = '';
      }
    } else if (!e.ctrlKey && !e.altKey) {
      // reset if released without completing
      if (secretBuf && secretBuf.length < 4) secretBuf = '';
    }
  });

  function logoutAdmin() {
    clearSession();
    lockAdmin();
    const err = document.getElementById('loginErr');
    if (err) err.textContent = '';
    const pass = document.getElementById('loginPass');
    if (pass) pass.value = '';
    status('Anda telah keluar. Masukkan password untuk mengakses panel.');
  }

  // Paksa login setiap buka admin, kecuali deep-link dari frontend (edit / focus=ppdb + password sudah diisi)
  const _urlParams = new URLSearchParams(location.search);
  const _deepEdit = _urlParams.get('edit');
  const _focusPpdb = _urlParams.get('focus') === 'ppdb' || sessionStorage.getItem('sdit_di_ppdb_focus') === '1';
  if (!_deepEdit && !_focusPpdb) {
    clearSession();
  }
  lockAdmin();

  const btnLogin = document.getElementById('btnLogin');
  const inpLogin = document.getElementById('loginPass');
  if (btnLogin) btnLogin.onclick = tryLogin;
  if (inpLogin) inpLogin.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });

  // Auto-unlock if deep-link + already authenticated from frontend prompt
  if ((_deepEdit || _focusPpdb) && isAuthed()) {
    unlockAdmin();
  } else {
    lockAdmin();
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.onclick = logoutAdmin;

  function sheetsConfigured() {
    const c = cfg();
    return !!(c.useSheets && c.sheetsApiUrl);
  }

  function updateSheetsHint() {
    const el = $('sheetsHint');
    if (!el) return;
    if (sheetsConfigured()) {
      el.innerHTML = 'Google Sheets: <strong>aktif</strong> — data website via Apps Script. Token & password admin ada di <strong>Script properties</strong> (bukan di GitHub).';
    } else {
      el.innerHTML = '⚠️ Isi <code>sheetsApiUrl</code> di <code>js/config.js</code>. Rahasia (<code>API_TOKEN</code>, <code>ADMIN_PASSWORD</code>) di Apps Script → Script properties. Lihat <code>apps-script/SETUP.md</code>.';
    }
  }

  async function loadFromSheets() {
    const conf = cfg();
    if (!conf.sheetsApiUrl) throw new Error('sheetsApiUrl kosong di config.js');
    const res = await fetch(conf.sheetsApiUrl + '?action=getSite', { cache: 'no-store' });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'getSite gagal');
    if (!j.data) throw new Error('Sheets belum berisi data site — klik Simpan sekali untuk mengisi');
    data = j.data;
    if (!data.media) data.media = [];
    if (!data.announcements) data.announcements = [];
    ensureSiteArrays(data);
    fillForm();
    status('✓ Data dimuat dari Google Sheets');
    return true;
  }

  async function loadFromFile() {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    data = await res.json();
    if (!data.media) data.media = [];
    if (!data.announcements) data.announcements = [];
    ensureSiteArrays(data);
    fillForm();
    status('Data dimuat dari data/site.json (fallback lokal)');
  }

  function loadFromStorage() {
    // localStorage no longer primary — return false always
    return false;
  }

  async function loadPreferred() {
    const conf = cfg();
    if (conf.useSheets && conf.sheetsApiUrl) {
      try {
        await loadFromSheets();
        loadPpdbList().catch(() => {});
        return;
      } catch (e) {
        status('Sheets belum siap (' + e.message + '). Memuat site.json…');
        await loadFromFile();
        loadPpdbList().catch(() => {});
        return;
      }
    }
    status('Peringatan: useSheets/sheetsApiUrl belum diisi. Memuat site.json.');
    await loadFromFile();
    loadPpdbList().catch(() => {});
  }

  function ensureSiteArrays(d) {
    if (!d) return;
    ['media','announcements','leadership','facilities','teachers','achievements','calendar','faq'].forEach((k) => {
      if (!Array.isArray(d[k])) d[k] = [];
    });
    if (!d.visionMission) d.visionMission = { vision: '', mission: [], motto: '' };
    if (!Array.isArray(d.visionMission.mission)) d.visionMission.mission = [];
    if (!d.fees) d.fees = { enabled: false, title: 'Informasi Biaya Pendidikan', note: '', items: [] };
    if (!Array.isArray(d.fees.items)) d.fees.items = [];
    if (!d.complaint) d.complaint = { enabled: false, email: '', whatsapp: '', note: '' };
    if (!d.ppdb) d.ppdb = {};
    if (!Array.isArray(d.ppdb.steps)) d.ppdb.steps = [];
    if (!Array.isArray(d.ppdb.schedule)) d.ppdb.schedule = [];
    if (!Array.isArray(d.ppdb.requirements)) d.ppdb.requirements = [];
  }

  function fillForm() {
    if (!data) return;
    ensureSiteArrays(data);
    const s = data.school || {};
    const set = (id, v) => { const n = $(id); if (n) n.value = v == null ? '' : String(v); };
    set('fName', s.name || '');
    set('fTagline', s.tagline || '');
    set('fAddress', s.address || '');
    set('fEmail', s.email || '');
    set('fWa', s.whatsapp || '');
    set('fPrincipal', s.principal || '');
    set('fYayasan', s.yayasan || '');
    set('fHours', s.jamOperasional || '');
    set('fSekolahKita', s.sekolahKitaUrl || '');
    set('fIzin', s.izinOperasional || '');
    const vm = data.visionMission || {};
    set('fVision', vm.vision || '');
    set('fMission', (vm.mission || []).join('\n'));
    set('fMotto', vm.motto || '');
    const c = data.complaint || {};
    set('fComplaintEnabled', String(!!c.enabled));
    set('fComplaintNote', c.note || '');
    set('fComplaintEmail', c.email || '');
    set('fComplaintWa', c.whatsapp || '');
    const p = data.ppdb || {};
    set('fPpdbYear', p.year || '');
    set('fPpdbOpen', String(p.open !== false));
    set('fPpdbNote', p.note || '');
    set('fPpdbQuota', p.quota || '');
    set('fPpdbFlowNote', p.flowNote || '');
    set('fPpdbPrivacy', p.privacyNote || '');
    set('fPpdbReqs', (p.requirements || []).join('\n'));
    const fees = data.fees || {};
    set('fFeesEnabled', String(!!fees.enabled));
    set('fFeesTitle', fees.title || 'Informasi Biaya Pendidikan');
    set('fFeesNote', fees.note || '');
    renderLists();
  }

  function readForm() {
    if (!data.school) data.school = {};
    if (!data.ppdb) data.ppdb = {};
    if (!data.visionMission) data.visionMission = { vision: '', mission: [], motto: '' };
    if (!data.fees) data.fees = { enabled: false, title: '', note: '', items: data.fees && data.fees.items || [] };
    if (!data.complaint) data.complaint = {};
    const g = (id) => { const n = $(id); return n ? n.value.trim() : ''; };
    data.school.name = g('fName');
    data.school.tagline = g('fTagline');
    data.school.address = g('fAddress');
    data.school.email = g('fEmail');
    data.school.whatsapp = g('fWa');
    data.school.principal = g('fPrincipal');
    data.school.yayasan = g('fYayasan');
    data.school.jamOperasional = g('fHours');
    data.school.sekolahKitaUrl = g('fSekolahKita');
    data.school.izinOperasional = g('fIzin');
    data.visionMission.vision = g('fVision');
    data.visionMission.mission = g('fMission').split('\n').map((x) => x.trim()).filter(Boolean);
    data.visionMission.motto = g('fMotto');
    data.complaint.enabled = g('fComplaintEnabled') === 'true';
    data.complaint.note = g('fComplaintNote');
    data.complaint.email = g('fComplaintEmail');
    data.complaint.whatsapp = g('fComplaintWa');
    data.ppdb.year = g('fPpdbYear');
    data.ppdb.open = g('fPpdbOpen') === 'true';
    data.ppdb.note = g('fPpdbNote');
    data.ppdb.quota = g('fPpdbQuota');
    data.ppdb.flowNote = g('fPpdbFlowNote');
    data.ppdb.privacyNote = g('fPpdbPrivacy');
    data.ppdb.requirements = g('fPpdbReqs').split('\n').map((x) => x.trim()).filter(Boolean);
    if (!Array.isArray(data.fees.items)) data.fees.items = [];
    data.fees.enabled = g('fFeesEnabled') === 'true';
    data.fees.title = g('fFeesTitle') || 'Informasi Biaya Pendidikan';
    data.fees.note = g('fFeesNote');
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  /** Path relatif di site.json (images/…) harus ../ di panel /admin/ */
  function resolveAdminAsset(src) {
    if (!src) return '';
    const s = String(src).trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('blob:')) return s;
    if (s.startsWith('../')) return s;
    if (s.startsWith('/')) return s;
    return '../' + s.replace(/^\.\//, '');
  }

  // --- CRUD Modal ---
  const SCHEMAS = {
    media: [
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'url', label: 'URL / Link', type: 'text' },
      { key: 'type', label: 'Tipe (foto/video)', type: 'text' },
      { key: 'source', label: 'Sumber', type: 'text' },
      { key: 'category', label: 'Kategori', type: 'text' },
      { key: 'description', label: 'Deskripsi', type: 'textarea' },
      { key: 'thumb', label: 'URL Thumbnail', type: 'text' },
      { key: 'embedUrl', label: 'Embed URL', type: 'text' },
      { key: 'date', label: 'Tanggal', type: 'text' }
    ],
    carousel: [
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'image', label: 'URL / path gambar', type: 'text' },
      { key: 'imagePosition', label: 'Posisi gambar (mis. center 30%)', type: 'text' },
      { key: 'cta', label: 'Teks tombol CTA', type: 'text' },
      { key: 'ctaLink', label: 'Link CTA', type: 'text' }
    ],
    articles: [
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'category', label: 'Kategori', type: 'text' },
      { key: 'date', label: 'Tanggal', type: 'text' },
      { key: 'excerpt', label: 'Ringkasan', type: 'textarea' },
      { key: 'image', label: 'URL / path gambar', type: 'text' }
    ],
    gallery: [
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'image', label: 'URL / path gambar', type: 'text' },
      { key: 'type', label: 'Tipe', type: 'text' }
    ],
    videos: [
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'youtubeId', label: 'YouTube ID', type: 'text' },
      { key: 'thumb', label: 'URL Thumbnail', type: 'text' }
    ],
    announcements: [
      { key: 'title', label: 'Judul', type: 'text' },
      { key: 'body', label: 'Isi', type: 'textarea' },
      { key: 'mode', label: 'Mode', type: 'text' },
      { key: 'image', label: 'Gambar', type: 'text' }
    ],
    leadership: [
      { key: 'name', label: 'Nama', type: 'text' },
      { key: 'role', label: 'Jabatan', type: 'text' },
      { key: 'photo', label: 'URL Foto', type: 'text' },
      { key: 'bio', label: 'Bio singkat', type: 'textarea' }
    ],
    facilities: [
      { key: 'name', label: 'Nama fasilitas', type: 'text' },
      { key: 'icon', label: 'Emoji ikon', type: 'text' },
      { key: 'image', label: 'URL gambar', type: 'text' },
      { key: 'desc', label: 'Deskripsi', type: 'textarea' }
    ],
    teachers: [
      { key: 'name', label: 'Nama', type: 'text' },
      { key: 'role', label: 'Peran / jabatan', type: 'text' },
      { key: 'subject', label: 'Mapel / bidang', type: 'text' },
      { key: 'photo', label: 'URL foto', type: 'text' }
    ],
    achievements: [
      { key: 'title', label: 'Judul prestasi', type: 'text' },
      { key: 'year', label: 'Tahun', type: 'text' },
      { key: 'level', label: 'Tingkat', type: 'text' },
      { key: 'desc', label: 'Keterangan', type: 'textarea' }
    ],
    calendar: [
      { key: 'title', label: 'Judul agenda', type: 'text' },
      { key: 'date', label: 'Tanggal mulai', type: 'text' },
      { key: 'endDate', label: 'Tanggal selesai', type: 'text' },
      { key: 'type', label: 'Jenis', type: 'text' },
      { key: 'desc', label: 'Keterangan', type: 'textarea' }
    ],
    faq: [
      { key: 'q', label: 'Pertanyaan', type: 'text' },
      { key: 'a', label: 'Jawaban', type: 'textarea' }
    ],
    'ppdb.steps': [
      { key: 'title', label: 'Nama tahap', type: 'text' },
      { key: 'desc', label: 'Keterangan', type: 'textarea' }
    ],
    'ppdb.schedule': [
      { key: 'label', label: 'Label kegiatan', type: 'text' },
      { key: 'date', label: 'Tanggal / rentang', type: 'text' },
      { key: 'note', label: 'Catatan', type: 'textarea' }
    ],
    'fees.items': [
      { key: 'name', label: 'Komponen biaya', type: 'text' },
      { key: 'amount', label: 'Nominal', type: 'text' },
      { key: 'period', label: 'Periode', type: 'text' },
      { key: 'note', label: 'Keterangan', type: 'textarea' }
    ],
    programs: [
      { key: 'title', label: 'Judul program', type: 'text' },
      { key: 'icon', label: 'Emoji ikon', type: 'text' },
      { key: 'desc', label: 'Deskripsi', type: 'textarea' }
    ],
    activities: [
      { key: 'day', label: 'Hari / label waktu', type: 'text' },
      { key: 'title', label: 'Judul kegiatan', type: 'text' },
      { key: 'desc', label: 'Deskripsi', type: 'textarea' }
    ],
    stats: [
      { key: 'value', label: 'Nilai (angka/teks)', type: 'text' },
      { key: 'label', label: 'Label', type: 'text' }
    ]
  };

  function getListRef(type) {
    if (type === 'fees.items') {
      if (!data.fees) data.fees = { enabled: false, title: '', note: '', items: [] };
      if (!Array.isArray(data.fees.items)) data.fees.items = [];
      return data.fees.items;
    }
    if (type === 'ppdb.steps') {
      if (!data.ppdb) data.ppdb = {};
      if (!Array.isArray(data.ppdb.steps)) data.ppdb.steps = [];
      return data.ppdb.steps;
    }
    if (type === 'ppdb.schedule') {
      if (!data.ppdb) data.ppdb = {};
      if (!Array.isArray(data.ppdb.schedule)) data.ppdb.schedule = [];
      return data.ppdb.schedule;
    }
    if (!Array.isArray(data[type])) data[type] = [];
    return data[type];
  }

  function openEditor(type, index) {
    if (type === 'announcements') {
      openAnnEditor(index);
      return;
    }
    editCtx = { type, index };
    const list = getListRef(type);
    const item = index >= 0 ? Object.assign({}, list[index]) : {};
    const schema = SCHEMAS[type] || [];
    $('editModalTitle').textContent = index >= 0 ? 'Edit ' + type : 'Tambah ' + type;
    const box = $('editFields');
    box.innerHTML = '';
    schema.forEach((f) => {
      const lab = document.createElement('label');
      lab.textContent = f.label;
      box.appendChild(lab);
      let input;
      if (f.type === 'textarea') {
        input = document.createElement('textarea');
        input.value = item[f.key] || '';
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = item[f.key] || '';
      }
      input.dataset.key = f.key;
      input.id = 'ef_' + f.key;
      box.appendChild(input);
    });
    $('editModal').hidden = false;
  }

  function closeEditor() {
    $('editModal').hidden = true;
    editCtx = null;
  }

  function saveEditor() {
    if (!editCtx) return;
    const { type, index } = editCtx;
    const schema = SCHEMAS[type] || [];
    const list = getListRef(type);
    const item = index >= 0 ? Object.assign({}, list[index]) : { id: String(type).replace(/\W/g, '').slice(0, 6) + Date.now() };
    schema.forEach((f) => {
      const el = document.getElementById('ef_' + f.key);
      if (el) item[f.key] = el.value.trim();
    });
    // Field wajib agar tampil di frontend
    const requiredKey = {
      facilities: 'name', teachers: 'name', leadership: 'name',
      achievements: 'title', calendar: 'title', faq: 'q',
      'ppdb.steps': 'title', 'ppdb.schedule': 'label', 'fees.items': 'name',
      carousel: 'title', articles: 'title', gallery: 'title', videos: 'title', media: 'title',
      programs: 'title', activities: 'title', stats: 'label'
    }[type];
    if (requiredKey && !(item[requiredKey] || '').trim()) {
      status('✗ Isi field wajib dulu: ' + requiredKey);
      const el = document.getElementById('ef_' + requiredKey);
      if (el) { el.focus(); el.style.outline = '2px solid #c0392b'; }
      return;
    }
    if (index >= 0) list[index] = item;
    else list.unshift(item);
    window.__siteDirty = true;
    const db = document.getElementById('dirtyBanner');
    if (db) { db.hidden = false; db.style.display = 'block'; }
    closeEditor();
    renderLists();
    status('✓ Item disimpan di panel. Klik tombol hijau "Simpan ke Google Sheets" agar tampil di website publik.');
  }

  function themedConfirm(message) {
    return new Promise((resolve) => {
      let overlay = document.getElementById('themedConfirm');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'themedConfirm';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(8,76,55,.82);display:grid;place-items:center;padding:1rem;backdrop-filter:blur(5px)';
        overlay.innerHTML = '<div style="background:#fff;border-radius:16px;padding:1.35rem 1.4rem;width:min(400px,100%);border:2px solid rgba(201,162,39,.45);box-shadow:0 24px 60px rgba(8,76,55,.35)"><p id="themedConfirmMsg" style="color:#084C37;font-weight:600;margin-bottom:1rem;line-height:1.5"></p><div style="display:flex;gap:.5rem;justify-content:flex-end"><button type="button" id="themedConfirmNo" class="btn btn-ghost">Batal</button><button type="button" id="themedConfirmYes" class="btn btn-accent">Ya, lanjutkan</button></div></div>';
        document.body.appendChild(overlay);
      }
      overlay.style.display = 'grid';
      document.getElementById('themedConfirmMsg').textContent = message;
      const yes = document.getElementById('themedConfirmYes');
      const no = document.getElementById('themedConfirmNo');
      const done = (val) => { overlay.style.display = 'none'; resolve(val); };
      yes.onclick = () => done(true);
      no.onclick = () => done(false);
      overlay.onclick = (e) => { if (e.target === overlay) done(false); };
    });
  }

  async function deleteItem(type, index) {
    if (!(await themedConfirm('Hapus item ini? Simpan ke Google Sheets agar perubahan permanen.'))) return;
    getListRef(type).splice(index, 1);
    window.__siteDirty = true;
    const db = document.getElementById('dirtyBanner');
    if (db) { db.hidden = false; db.style.display = 'block'; }
    renderLists();
    status('Item dihapus. Klik Simpan ke Browser.');
  }

  function buildItemPreviewHtml(type, item) {
    item = item || {};
    const img = (key) => {
      const src = item[key];
      if (!src) return '';
      const r = resolveAdminAsset(src);
      return '<img src="' + escapeHtml(r) + '" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:12px;margin-bottom:.75rem;background:#e8f5ef">';
    };
    const h = (t) => escapeHtml(t || '');
    if (type === 'facilities') {
      return img('image') +
        (item.icon ? '<div style="font-size:1.6rem;margin-bottom:.35rem">' + h(item.icon) + '</div>' : '') +
        '<h3 style="margin:0 0 .4rem;color:#084C37">' + h(item.name) + '</h3>' +
        '<p style="margin:0;color:#5B6575;line-height:1.55">' + h(item.desc) + '</p>' +
        '<p class="hint" style="margin-top:1rem">Tampil di halaman publik: section <strong>Fasilitas</strong> (menu Info lainnya).</p>';
    }
    if (type === 'teachers' || type === 'leadership') {
      return img('photo') +
        '<div style="text-align:center">' +
        (item.role ? '<div style="color:#0B6E4F;font-weight:700;font-size:.85rem;margin-bottom:.35rem">' + h(item.role) + '</div>' : '') +
        '<h3 style="margin:0 0 .4rem;color:#084C37">' + h(item.name) + '</h3>' +
        (item.subject ? '<p style="margin:0;color:#5B6575">' + h(item.subject) + '</p>' : '') +
        (item.bio ? '<p style="margin:.5rem 0 0;color:#5B6575;line-height:1.5">' + h(item.bio) + '</p>' : '') +
        '</div>';
    }
    if (type === 'achievements') {
      return '<span style="display:inline-block;background:#F5E6B8;color:#084C37;font-weight:800;font-size:.75rem;padding:.25rem .6rem;border-radius:999px;margin-bottom:.5rem">' +
        h([item.year, item.level].filter(Boolean).join(' · ')) + '</span>' +
        '<h3 style="margin:0 0 .4rem;color:#084C37">' + h(item.title) + '</h3>' +
        '<p style="margin:0;color:#5B6575;line-height:1.55">' + h(item.desc) + '</p>';
    }
    if (type === 'calendar') {
      return '<div style="font-weight:800;color:#0B6E4F;margin-bottom:.35rem">' + h([item.date, item.endDate].filter(Boolean).join(' – ')) + '</div>' +
        (item.type ? '<div style="font-size:.75rem;text-transform:uppercase;color:#5B6575;margin-bottom:.35rem">' + h(item.type) + '</div>' : '') +
        '<h3 style="margin:0 0 .4rem;color:#084C37">' + h(item.title) + '</h3>' +
        '<p style="margin:0;color:#5B6575">' + h(item.desc) + '</p>';
    }
    if (type === 'faq') {
      return '<strong style="color:#084C37">Q: ' + h(item.q) + '</strong><p style="margin:.5rem 0 0;color:#5B6575">A: ' + h(item.a) + '</p>';
    }
    if (type === 'ppdb.steps') {
      return '<strong style="color:#084C37">' + h(item.title) + '</strong><p style="margin:.4rem 0 0;color:#5B6575">' + h(item.desc) + '</p>';
    }
    if (type === 'ppdb.schedule') {
      return '<div style="font-weight:700;color:#0B6E4F">' + h(item.date) + '</div><strong>' + h(item.label) + '</strong><p style="margin:.35rem 0 0;color:#5B6575">' + h(item.note) + '</p>';
    }
    if (type === 'fees.items') {
      return '<strong style="color:#084C37">' + h(item.name) + '</strong>' +
        '<div style="font-weight:700;margin:.35rem 0">' + h(item.amount) + (item.period ? ' / ' + h(item.period) : '') + '</div>' +
        '<p style="margin:0;color:#5B6575">' + h(item.note) + '</p>';
    }
    if (type === 'carousel') {
      return img('image') + '<h3 style="margin:0 0 .35rem;color:#084C37">' + h(item.title) + '</h3><p style="margin:0;color:#5B6575">' + h(item.subtitle) + '</p>';
    }
    if (type === 'articles') {
      return img('image') + '<div style="font-size:.8rem;color:#0B6E4F;font-weight:700">' + h(item.category) + ' · ' + h(item.date) + '</div>' +
        '<h3 style="margin:.35rem 0;color:#084C37">' + h(item.title) + '</h3><p style="margin:0;color:#5B6575">' + h(item.excerpt) + '</p>';
    }
    if (type === 'gallery' || type === 'media') {
      return img(item.thumb ? 'thumb' : 'image') || img('url') || img('image') +
        '<strong>' + h(item.title) + '</strong><p style="margin:.35rem 0 0;color:#5B6575;font-size:.85rem">' + h(item.type || item.source || '') + '</p>';
    }
    if (type === 'videos') {
      const id = item.youtubeId || '';
      const th = id ? 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg' : (item.thumb || '');
      return (th ? '<img src="' + escapeHtml(th) + '" style="width:100%;border-radius:12px;margin-bottom:.5rem" alt="">' : '') +
        '<strong>' + h(item.title) + '</strong>';
    }
    if (type === 'programs') {
      return (item.icon ? '<div style="font-size:1.6rem">' + h(item.icon) + '</div>' : '') +
        '<h3 style="margin:.35rem 0;color:#084C37">' + h(item.title) + '</h3><p style="margin:0;color:#5B6575">' + h(item.desc) + '</p>';
    }
    if (type === 'activities') {
      return '<div style="font-weight:800;color:#0B6E4F">' + h(item.day) + '</div><h3 style="margin:.35rem 0;color:#084C37">' + h(item.title) + '</h3><p style="margin:0;color:#5B6575">' + h(item.desc) + '</p>';
    }
    if (type === 'stats') {
      return '<div style="font-size:1.8rem;font-weight:800;color:#0B6E4F">' + h(item.value) + '</div><div>' + h(item.label) + '</div>';
    }
    // generic
    return '<pre style="white-space:pre-wrap;font-size:.82rem;margin:0">' + h(JSON.stringify(item, null, 2)) + '</pre>';
  }

  function rowActions(type, index) {
    const wrap = document.createElement('div');
    wrap.className = 'actions-row';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'btn btn-accent';
    prev.textContent = 'Preview';
    prev.setAttribute('data-tip', 'Lihat pratinjau tampilan item ini seperti di halaman publik.');
    prev.onclick = () => {
      const list = getListRef(type);
      const item = list[index] || {};
      openPreviewCard('Preview — ' + type, buildItemPreviewHtml(type, item));
    };
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn btn-primary';
    edit.textContent = 'Edit';
    edit.setAttribute('data-tip', 'Ubah data item. Setelah simpan form, klik Simpan ke Google Sheets agar tampil di website publik.');
    edit.onclick = () => openEditor(type, index);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-ghost';
    del.textContent = 'Hapus';
    del.setAttribute('data-tip', 'Hapus item. Klik Simpan ke Google Sheets agar permanen.');
    del.onclick = () => deleteItem(type, index);
    wrap.appendChild(prev);
    wrap.appendChild(edit);
    wrap.appendChild(del);
    return wrap;
  }

  function openPreviewCard(title, htmlBody) {
    let overlay = document.getElementById('previewOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'previewOverlay';
      overlay.innerHTML = `<div class="preview-card">
        <div class="preview-card-head">
          <strong id="previewCardTitle">Preview</strong>
          <button type="button" class="btn btn-ghost" id="previewCardClose">Tutup</button>
        </div>
        <div class="preview-card-body" id="previewCardBody"></div>
      </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });
      document.getElementById('previewCardClose').onclick = () => overlay.classList.remove('open');
    }
    document.getElementById('previewCardTitle').textContent = title || 'Preview';
    document.getElementById('previewCardBody').innerHTML = htmlBody;
    overlay.classList.add('open');
  }

    function listThumbHtml(src, label) {
    if (!src) {
      return `<div class="thumb-prev" title="Tidak ada thumbnail" style="display:grid;place-items:center;font-size:.7rem;color:#888">—</div>`;
    }
    const resolved = resolveAdminAsset(src);
    return `<img class="thumb-prev" src="${escapeHtml(resolved)}" alt="" loading="lazy"
      onload="var s=this.nextElementSibling;if(s){s.textContent='✓ OK';s.className='preview-status ok'}"
      onerror="this.classList.add('err');var s=this.nextElementSibling;if(s){s.textContent='✗ Gagal';s.className='preview-status err'}">`;
  }

  let annEditIndex = -1;

  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fromLocalInput(v) {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }

  function compressImageFile(file, maxW, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, (maxW || 800) / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.72));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function updateAnnPreview() {
    const prev = $('annPreview');
    if (!prev) return;
    const title = ($('annTitle') && $('annTitle').value) || 'Pengumuman';
    const body = ($('annBody') && $('annBody').value) || '';
    const image = ($('annImage') && $('annImage').value) || '';
    prev.innerHTML = (image ? '<img src="' + escapeHtml(image) + '" alt="">' : '') +
      '<strong>' + escapeHtml(title) + '</strong>' +
      '<p class="hint" style="margin:4px 0 0">' + escapeHtml(body).slice(0, 180) + '</p>';
  }

  function openAnnEditor(index) {
    annEditIndex = index;
    const list = data.announcements || [];
    const a = index >= 0 ? (list[index] || {}) : {};
    $('annEditor').hidden = false;
    $('annEditorTitle').textContent = index >= 0 ? 'Edit pengumuman' : 'Tambah pengumuman';
    $('annTitle').value = a.title || '';
    $('annBody').value = a.body || '';
    $('annMode').value = a.mode || 'popup';
    $('annFreq').value = a.frequency || 'session';
    $('annStart').value = toLocalInput(a.startAt);
    $('annEnd').value = toLocalInput(a.endAt);
    $('annDuration').value = a.durationSec != null ? a.durationSec : 12;
    $('annPriority').value = a.priority != null ? a.priority : 0;
    $('annCtaText').value = a.ctaText || '';
    $('annCtaLink').value = a.ctaLink || '';
    $('annImage').value = a.image || '';
    $('annActive').value = a.active === false ? 'false' : 'true';
    $('annDismiss').value = a.dismissible === false ? 'false' : 'true';
    updateAnnPreview();
    $('annEditor').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeAnnEditor() {
    annEditIndex = -1;
    $('annEditor').hidden = true;
  }


  function buildAnnFromForm() {
    return {
      id: (annEditIndex >= 0 && data.announcements && data.announcements[annEditIndex] && data.announcements[annEditIndex].id)
        ? data.announcements[annEditIndex].id
        : ('ann_preview_' + Date.now()),
      title: ($('annTitle').value || '').trim() || 'Pengumuman',
      body: ($('annBody').value || '').trim(),
      mode: $('annMode').value || 'popup',
      frequency: 'always',
      startAt: '',
      endAt: '',
      durationSec: Math.max(3, parseInt($('annDuration').value, 10) || 12),
      priority: 999,
      ctaText: ($('annCtaText').value || '').trim(),
      ctaLink: ($('annCtaLink').value || '').trim(),
      image: ($('annImage').value || '').trim(),
      active: true,
      dismissible: $('annDismiss').value !== 'false',
      _preview: true
    };
  }

  function previewAnnOnPublic() {
    const item = buildAnnFromForm();
    try {
      sessionStorage.setItem('sdit_ann_preview', JSON.stringify(item));
    } catch (e) {
      status('Gagal menyimpan preview (storage penuh?). Coba tanpa gambar besar.');
      return;
    }
    window.open('../?previewAnn=1', '_blank', 'noopener');
    status('Preview dibuka di tab baru (mengabaikan jadwal mulai/selesai).');
  }

  function saveAnnEditor() {
    if (!data.announcements) data.announcements = [];
    const item = {
      id: (annEditIndex >= 0 && data.announcements[annEditIndex] && data.announcements[annEditIndex].id)
        ? data.announcements[annEditIndex].id
        : ('ann' + Date.now()),
      title: ($('annTitle').value || '').trim() || 'Pengumuman',
      body: ($('annBody').value || '').trim(),
      mode: $('annMode').value || 'popup',
      frequency: $('annFreq').value || 'session',
      startAt: fromLocalInput($('annStart').value),
      endAt: fromLocalInput($('annEnd').value),
      durationSec: Math.max(3, parseInt($('annDuration').value, 10) || 12),
      priority: parseInt($('annPriority').value, 10) || 0,
      ctaText: ($('annCtaText').value || '').trim(),
      ctaLink: ($('annCtaLink').value || '').trim(),
      image: ($('annImage').value || '').trim(),
      active: $('annActive').value !== 'false',
      dismissible: $('annDismiss').value !== 'false'
    };
    if (annEditIndex >= 0) data.announcements[annEditIndex] = item;
    else data.announcements.unshift(item);
    closeAnnEditor();
    renderLists();
    status('Pengumuman disimpan di form. Klik "Simpan ke Google Sheets" agar tampil di website.');
  }

  function renderAnnList() {
    const box = $('annList');
    if (!box) return;
    box.innerHTML = '';
    const list = data.announcements || [];
    if (!list.length) {
      box.innerHTML = '<p class="hint">Belum ada pengumuman.</p>';
      return;
    }
    list.forEach((a, i) => {
      const row = document.createElement('div');
      row.className = 'list-item';
      const left = document.createElement('div');
      left.className = 'li-thumb';
      left.innerHTML = listThumbHtml(a.image) + '<span class="preview-status">…</span>';
      const mid = document.createElement('div');
      mid.className = 'li-info';
      mid.innerHTML = '<span class="badge">' + escapeHtml(a.mode || 'popup') + '</span>' +
        (a.active === false ? '<span class="badge" style="background:#fee2e2;color:#991b1b">nonaktif</span>' : '<span class="badge foto">aktif</span>') +
        ' <strong>' + escapeHtml(a.title || 'Pengumuman') + '</strong>' +
        '<div class="meta">' + escapeHtml((a.body || '').slice(0, 80)) + '</div>' +
        '<div class="meta">⏱ ' + (a.durationSec || 12) + 's · ' + escapeHtml(a.frequency || 'session') +
        (a.startAt ? ' · mulai ' + escapeHtml(a.startAt.slice(0, 16)) : '') +
        (a.endAt ? ' · selesai ' + escapeHtml(a.endAt.slice(0, 16)) : '') + '</div>';
      row.appendChild(left);
      row.appendChild(mid);
      row.appendChild(rowActions('announcements', i));
      box.appendChild(row);
    });
  }

  function renderExtraLists() {
    function thumbHtml(src, fallback) {
      if (src) {
        return '<div class="li-thumb"><img class="thumb-prev" src="' + escapeHtml(resolveAdminAsset(src)) + '" alt="" onerror="this.classList.add(\'err\')"></div>';
      }
      return '<div class="li-thumb" style="display:grid;place-items:center;font-size:1.5rem;background:#e8f5ef">' + (fallback || '•') + '</div>';
    }
    function simpleList(boxId, type, opts) {
      const box = $(boxId);
      if (!box) return;
      box.innerHTML = '';
      const list = getListRef(type);
      if (!list.length) {
        box.innerHTML = '<p class="hint">Belum ada data. Klik tambah → isi form → lalu <strong>Simpan ke Google Sheets</strong>.</p>';
        return;
      }
      list.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'list-item';
        const imgKey = opts.imageKey;
        const icon = opts.iconFn ? opts.iconFn(item) : '•';
        const src = imgKey ? (item[imgKey] || '') : '';
        row.insertAdjacentHTML('beforeend', thumbHtml(src, icon));
        const mid = document.createElement('div');
        mid.className = 'li-info';
        const title = opts.titleFn(item);
        const meta = opts.metaFn ? opts.metaFn(item) : '';
        mid.innerHTML = '<strong>' + escapeHtml(title) + '</strong>' +
          (meta ? '<div class="meta">' + escapeHtml(meta) + '</div>' : '');
        row.appendChild(mid);
        row.appendChild(rowActions(type, i));
        box.appendChild(row);
      });
    }
    simpleList('leadershipList', 'leadership', {
      titleFn: (x) => (x.name || 'Tanpa nama') + (x.role ? ' — ' + x.role : ''),
      metaFn: (x) => x.bio || '',
      imageKey: 'photo',
      iconFn: () => '👤'
    });
    simpleList('facilitiesList', 'facilities', {
      titleFn: (x) => x.name || 'Fasilitas',
      metaFn: (x) => x.desc || '',
      imageKey: 'image',
      iconFn: (x) => x.icon || '🏫'
    });
    simpleList('teachersList', 'teachers', {
      titleFn: (x) => x.name || 'Guru',
      metaFn: (x) => [x.role, x.subject].filter(Boolean).join(' · '),
      imageKey: 'photo',
      iconFn: () => '👩‍🏫'
    });
    simpleList('achievementsList', 'achievements', {
      titleFn: (x) => x.title || 'Prestasi',
      metaFn: (x) => [x.year, x.level, x.desc].filter(Boolean).join(' · '),
      iconFn: () => '🏆'
    });
    simpleList('calendarListAdmin', 'calendar', {
      titleFn: (x) => x.title || 'Agenda',
      metaFn: (x) => [x.date, x.endDate, x.type].filter(Boolean).join(' · '),
      iconFn: () => '📅'
    });
    simpleList('faqList', 'faq', {
      titleFn: (x) => x.q || 'FAQ',
      metaFn: (x) => x.a || '',
      iconFn: () => '❓'
    });
    simpleList('ppdbStepsList', 'ppdb.steps', {
      titleFn: (x) => x.title || 'Tahap',
      metaFn: (x) => x.desc || '',
      iconFn: () => '①'
    });
    simpleList('ppdbScheduleList', 'ppdb.schedule', {
      titleFn: (x) => x.label || 'Jadwal',
      metaFn: (x) => [x.date, x.note].filter(Boolean).join(' · '),
      iconFn: () => '🗓️'
    });
    simpleList('feesList', 'fees.items', {
      titleFn: (x) => x.name || 'Biaya',
      metaFn: (x) => [x.amount, x.period, x.note].filter(Boolean).join(' · '),
      iconFn: () => '💰'
    });
    simpleList('programsList', 'programs', {
      titleFn: (x) => x.title || 'Program',
      metaFn: (x) => x.desc || '',
      iconFn: (x) => x.icon || '⭐'
    });
    simpleList('activitiesList', 'activities', {
      titleFn: (x) => (x.title || 'Kegiatan') + (x.day ? ' — ' + x.day : ''),
      metaFn: (x) => x.desc || '',
      iconFn: () => '📅'
    });
  }

  function renderLists() {
    renderAnnList();
    renderExtraLists();

    // Media
    const mBox = $('mediaList');
    if (mBox) {
      mBox.innerHTML = '';
      (data.media || []).forEach((m, i) => {
        const row = document.createElement('div');
        row.className = 'list-item';
        const badge = m.type === 'video' ? 'video' : 'foto';
        const thumbSrc = m.thumb || (m.source === 'youtube' && m.shortcode
          ? `https://img.youtube.com/vi/${m.shortcode}/hqdefault.jpg` : '');
        const left = document.createElement('div');
        left.className = 'li-thumb';
        left.innerHTML = listThumbHtml(thumbSrc) + `<span class="preview-status">…</span>`;
        const mid = document.createElement('div');
        mid.className = 'li-info';
        mid.innerHTML = `
          <span class="badge ${badge}">${escapeHtml(m.type || 'foto')}</span>
          <span class="badge">${escapeHtml(m.source || '')}</span>
          <strong>${escapeHtml(m.title || m.url)}</strong>
          <div class="meta">${escapeHtml(m.category || '')} · ${escapeHtml(m.date || '')}</div>
          <div class="meta" style="word-break:break-all">${escapeHtml(m.url || '')}</div>
          ${m.embedUrl ? `<button type="button" class="btn btn-ghost" style="margin-top:6px;padding:.35rem .7rem;font-size:.8rem" data-preview-embed="${escapeHtml(m.embedUrl)}">▶ Preview embed</button>` : ''}`;
        row.appendChild(left);
        row.appendChild(mid);
        row.appendChild(rowActions('media', i));
        mBox.appendChild(row);
      });
      if (!(data.media || []).length) mBox.innerHTML = '<p class="hint">Belum ada media.</p>';
      mBox.querySelectorAll('[data-preview-embed]').forEach((btn) => {
        btn.onclick = () => {
          const emb = btn.getAttribute('data-preview-embed');
          openPreviewCard('Preview embed', `<iframe src="${emb}" style="width:100%;height:360px;border:0;border-radius:12px;background:#111" allowfullscreen loading="lazy"></iframe>
            <p class="hint" style="margin-top:8px">Jika kosong, platform memblokir embed di domain ini.</p>`);
        };
      });
    }

    const cBox = $('carouselList');
    if (cBox) {
      cBox.innerHTML = '';
      (data.carousel || []).forEach((cItem, i) => {
        const row = document.createElement('div');
        row.className = 'list-item';
        const left = document.createElement('div');
        left.className = 'li-thumb';
        left.innerHTML = listThumbHtml(cItem.image) + `<span class="preview-status">…</span>`;
        const mid = document.createElement('div');
        mid.className = 'li-info';
        mid.innerHTML = `<span class="badge">#${i + 1}</span> <strong>${escapeHtml(cItem.title)}</strong>
          <div class="meta">${escapeHtml(cItem.image || '')}</div>`;
        row.appendChild(left);
        row.appendChild(mid);
        row.appendChild(rowActions('carousel', i));
        cBox.appendChild(row);
      });
    }

    const aBox = $('articleList');
    if (aBox) {
      aBox.innerHTML = '';
      (data.articles || []).forEach((a, i) => {
        const row = document.createElement('div');
        row.className = 'list-item';
        const left = document.createElement('div');
        left.className = 'li-thumb';
        left.innerHTML = listThumbHtml(a.image) + `<span class="preview-status">…</span>`;
        const mid = document.createElement('div');
        mid.className = 'li-info';
        mid.innerHTML = `<span class="badge">${escapeHtml(a.category || 'Berita')}</span> <strong>${escapeHtml(a.title)}</strong>
          <div class="meta">${escapeHtml(a.date || '')}</div>`;
        row.appendChild(left);
        row.appendChild(mid);
        row.appendChild(rowActions('articles', i));
        aBox.appendChild(row);
      });
    }

    const gBox = $('galleryList');
    if (gBox) {
      gBox.innerHTML = '';
      (data.gallery || []).forEach((g, i) => {
        const row = document.createElement('div');
        row.className = 'list-item';
        const left = document.createElement('div');
        left.className = 'li-thumb';
        left.innerHTML = listThumbHtml(g.image) + `<span class="preview-status">…</span>`;
        const mid = document.createElement('div');
        mid.className = 'li-info';
        mid.innerHTML = `<span class="badge foto">foto</span> <strong>${escapeHtml(g.title)}</strong>
          <div class="meta">${escapeHtml(g.image || '')}</div>`;
        row.appendChild(left);
        row.appendChild(mid);
        row.appendChild(rowActions('gallery', i));
        gBox.appendChild(row);
      });
    }

    const vBox = $('videoList');
    if (vBox) {
      vBox.innerHTML = '';
      (data.videos || []).forEach((v, i) => {
        const row = document.createElement('div');
        row.className = 'list-item';
        const ytThumb = v.thumb || (v.youtubeId ? `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg` : '');
        const left = document.createElement('div');
        left.className = 'li-thumb';
        left.innerHTML = listThumbHtml(ytThumb) + `<span class="preview-status">…</span>`;
        const mid = document.createElement('div');
        mid.className = 'li-info';
        mid.innerHTML = `<span class="badge video">video</span> <strong>${escapeHtml(v.title)}</strong>
          <div class="meta">YT: ${escapeHtml(v.youtubeId || '')}</div>
          ${v.youtubeId ? `<button type="button" class="btn btn-ghost" style="margin-top:6px;padding:.35rem .7rem;font-size:.8rem" data-yt="${escapeHtml(v.youtubeId)}">▶ Preview YouTube</button>` : ''}`;
        row.appendChild(left);
        row.appendChild(mid);
        row.appendChild(rowActions('videos', i));
        vBox.appendChild(row);
      });
      vBox.querySelectorAll('[data-yt]').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-yt');
          openPreviewCard('Preview YouTube', `<iframe src="https://www.youtube.com/embed/${id}" style="width:100%;height:320px;border:0;border-radius:12px" allowfullscreen loading="lazy"></iframe>`);
        };
      });
    }
  }

  async function save() {
    readForm();
    const conf = cfg();
    if (!(conf.useSheets && conf.sheetsApiUrl)) {
      status('✗ Belum dikonfigurasi: isi sheetsApiUrl di js/config.js.');
      return;
    }
    status('Menyimpan ke Google Sheets…');
    try {
      const res = await fetch(conf.sheetsApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveSite', token: getSessionToken(), data: data })
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'saveSite gagal');
      // clear public cache so frontend refetches
      try { localStorage.removeItem('sdit_di_site_cache_v2'); } catch (_) {}
      const cnt = j.counts || {};
      window.__siteDirty = false;
      const db2 = document.getElementById('dirtyBanner');
      if (db2) { db2.hidden = true; db2.style.display = 'none'; }
      const fac = (data.facilities || []).length;
      const tea = (data.teachers || []).length;
      const ach = (data.achievements || []).length;
      status('✓ Tersimpan ke Google Sheets · ' + (j.updatedAt || '') +
        ' · media:' + (cnt.media || 0) +
        ' carousel:' + (cnt.carousel || 0) +
        ' artikel:' + (cnt.articles || 0) +
        ' fasilitas:' + fac +
        ' guru:' + tea +
        ' prestasi:' + ach +
        ' — buka website publik (hard refresh) untuk melihat.');
    } catch (e) {
      status('✗ Gagal simpan ke Sheets: ' + e.message);
    }
  }

  async function reset() {
    if (!(await themedConfirm('Muat ulang data dari Google Sheets? Perubahan di form yang belum disimpan akan hilang.'))) return;
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('sdit_di_site_cache_v2'); } catch (_) {}
    await loadPreferred();
  }

  function exportJson() {
    readForm();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'site.json';
    a.click();
    status('File site.json diunduh. Upload ke folder data/ untuk produksi.');
  }

  function renderDetectPreview(parsed) {
    const prev = $('detectPreview');
    if (!prev || !window.MediaUtils.buildPreviewHtml) return;
    // merge optional thumb override
    const thumbInput = $('mediaThumb');
    const merged = Object.assign({}, parsed);
    if (thumbInput && thumbInput.value.trim()) {
      merged.thumb = thumbInput.value.trim();
    }
    if (merged.thumb) merged.thumb = resolveAdminAsset(merged.thumb);
    const p = window.MediaUtils.buildPreviewHtml(merged);
    prev.innerHTML = p.html + (p.note ? `<p class="hint" style="margin-top:6px">${escapeHtml(p.note)}</p>` : '');
  }

  function detectMedia() {
    const url = $('mediaUrl').value;
    const parsed = window.MediaUtils.parseMediaUrl(url);
    const box = $('detectBox');
    if (!parsed.ok) {
      box.classList.remove('show');
      status(parsed.error || 'Gagal deteksi');
      lastParsed = null;
      const prev = $('detectPreview');
      if (prev) prev.innerHTML = '';
      return;
    }
    lastParsed = parsed;
    box.classList.add('show');
    $('detectResult').textContent = `${parsed.type.toUpperCase()} · ${parsed.source} · ${parsed.canonical}`;
    $('mediaTitle').value = parsed.suggestedTitle || '';
    $('mediaCategory').value = parsed.suggestedCategory || '';
    $('mediaDesc').value = '';
    if ($('mediaThumb')) $('mediaThumb').value = parsed.thumb || '';
    renderDetectPreview(parsed);
    status('Link terdeteksi — cek preview di bawah. Jika gagal, isi URL Thumbnail manual.');
  }

  function addMedia() {
    if (!lastParsed) {
      status('Deteksi link dulu.');
      return;
    }
    const item = window.MediaUtils.makeMediaItem(lastParsed, {
      title: $('mediaTitle').value,
      description: $('mediaDesc').value,
      category: $('mediaCategory').value,
      thumb: ($('mediaThumb') && $('mediaThumb').value.trim()) || lastParsed.thumb || ''
    });
    data.media = data.media || [];
    data.media.unshift(item);
    renderLists();
    $('mediaUrl').value = '';
    if ($('mediaThumb')) $('mediaThumb').value = '';
    $('detectBox').classList.remove('show');
    lastParsed = null;
    status('Media ditambahkan. Klik Simpan ke Browser.');
  }

  async function sheetsRequest(action, payload) {
    const c = cfg();
    if (!c.sheetsApiUrl) throw new Error('sheetsApiUrl belum diisi di config.js');
    const isWrite = action !== 'list' && action !== 'ping' && action !== 'publish';
    if (isWrite) {
      const res = await fetch(c.sheetsApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action: action, token: getSessionToken() }, payload || {}))
      });
      return res.json();
    }
    const url = c.sheetsApiUrl + '?action=' + encodeURIComponent(action);
    const res = await fetch(url);
    return res.json();
  }

  async function syncToSheets() {
    // Alias: full save to Sheets
    await save();
  }

  async function pullFromSheets() {
    if (!sheetsConfigured()) { status('Aktifkan useSheets + sheetsApiUrl di js/config.js'); return; }
    status('Mengambil seluruh data dari Google Sheets…');
    try {
      await loadFromSheets();
    } catch (e) { status('Gagal ambil: ' + e.message); }
  }

  // Bind
  $('btnLoad').onclick = async () => { await loadPreferred(); };
  $('btnSave').onclick = save;
  $('btnReset').onclick = reset;
  $('btnExport').onclick = exportJson;
  $('btnDetect').onclick = detectMedia;
  $('btnAddMedia').onclick = addMedia;
  if ($('mediaThumb')) {
    $('mediaThumb').addEventListener('change', () => { if (lastParsed) renderDetectPreview(lastParsed); });
    $('mediaThumb').addEventListener('blur', () => { if (lastParsed) renderDetectPreview(lastParsed); });
  }
  $('btnSyncSheets').onclick = syncToSheets;
  $('btnPullSheets').onclick = pullFromSheets;
  $('btnEditSave').onclick = saveEditor;
  $('btnEditCancel').onclick = closeEditor;
  $('editModal').addEventListener('click', (e) => { if (e.target.id === 'editModal') closeEditor(); });

  const _bindAdd = (id, type) => { const b = $(id); if (b) b.onclick = () => openEditor(type, -1); };
  _bindAdd('btnAddLeadership', 'leadership');
  _bindAdd('btnAddFacility', 'facilities');
  _bindAdd('btnAddProgram', 'programs');
  _bindAdd('btnAddActivity', 'activities');
  _bindAdd('btnAddTeacher', 'teachers');
  _bindAdd('btnAddAchievement', 'achievements');
  _bindAdd('btnAddCalendar', 'calendar');
  _bindAdd('btnAddFaq', 'faq');
  _bindAdd('btnAddPpdbStep', 'ppdb.steps');
  _bindAdd('btnAddPpdbSchedule', 'ppdb.schedule');
  _bindAdd('btnAddFee', 'fees.items');
  $('btnAddCarousel').onclick = () => openEditor('carousel', -1);
  $('btnAddArticle').onclick = () => openEditor('articles', -1);
  $('btnAddGallery').onclick = () => openEditor('gallery', -1);
  const bv = $('btnAddVideo'); if (bv) bv.onclick = () => openEditor('videos', -1);

  updateSheetsHint();
  (async () => {
    await loadPreferred();
  })();


  /* ========== PPDB Registrations Admin ========== */
  let ppdbRows = [];
  let ppdbEditId = null;

  const PPDB_FIELDS = [
    { key: 'id', label: 'No. Registrasi', ro: true },
    { key: 'status', label: 'Status', type: 'select', options: ['Baru', 'Proses', 'Diterima', 'Ditolak'] },
    { key: 'tahun_ajaran', label: 'Tahun Ajaran' },
    { key: 'nama_lengkap', label: 'Nama Lengkap *' },
    { key: 'nik', label: 'NIK *' },
    { key: 'nisn', label: 'NISN' },
    { key: 'no_akta_lahir', label: 'No. Akta Kelahiran' },
    { key: 'tempat_lahir', label: 'Tempat Lahir' },
    { key: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
    { key: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', options: ['L', 'P'] },
    { key: 'agama', label: 'Agama' },
    { key: 'kewarganegaraan', label: 'Kewarganegaraan' },
    { key: 'anak_ke', label: 'Anak ke-' },
    { key: 'jumlah_saudara', label: 'Jumlah Saudara' },
    { key: 'kebutuhan_khusus', label: 'Berkebutuhan Khusus' },
    { key: 'alamat_jalan', label: 'Alamat Jalan', full: true },
    { key: 'rt', label: 'RT' },
    { key: 'rw', label: 'RW' },
    { key: 'desa_kelurahan', label: 'Desa/Kelurahan' },
    { key: 'kecamatan', label: 'Kecamatan' },
    { key: 'kabupaten_kota', label: 'Kabupaten/Kota' },
    { key: 'provinsi', label: 'Provinsi' },
    { key: 'kode_pos', label: 'Kode Pos' },
    { key: 'jarak_km', label: 'Jarak (km)' },
    { key: 'transportasi', label: 'Transportasi' },
    { key: 'asal_sekolah', label: 'Asal Sekolah' },
    { key: 'asal_sekolah_alamat', label: 'Alamat Asal Sekolah' },
    { key: 'tahun_lulus_asal', label: 'Tahun Lulus Asal' },
    { key: 'ayah_nama', label: 'Nama Ayah' },
    { key: 'ayah_nik', label: 'NIK Ayah' },
    { key: 'ayah_pendidikan', label: 'Pendidikan Ayah' },
    { key: 'ayah_pekerjaan', label: 'Pekerjaan Ayah' },
    { key: 'ayah_penghasilan', label: 'Penghasilan Ayah' },
    { key: 'ibu_nama', label: 'Nama Ibu' },
    { key: 'ibu_nik', label: 'NIK Ibu' },
    { key: 'ibu_pendidikan', label: 'Pendidikan Ibu' },
    { key: 'ibu_pekerjaan', label: 'Pekerjaan Ibu' },
    { key: 'ibu_penghasilan', label: 'Penghasilan Ibu' },
    { key: 'wali_nama', label: 'Nama Wali' },
    { key: 'wali_hubungan', label: 'Hubungan Wali' },
    { key: 'no_hp', label: 'No. HP / WA' },
    { key: 'email_ortu', label: 'Email Orang Tua' },
    { key: 'minat_program', label: 'Minat Program' },
    { key: 'tinggi_badan', label: 'Tinggi Badan (cm)' },
    { key: 'berat_badan', label: 'Berat Badan (kg)' },
    { key: 'catatan', label: 'Catatan', full: true, type: 'textarea' },
    { key: 'submitted_at', label: 'Waktu Kirim', ro: true }
  ];

  async function ppdbApi(action, payload) {
    const conf = cfg();
    if (!conf.sheetsApiUrl) throw new Error('sheetsApiUrl belum diisi di config.js');
    const body = Object.assign({ action: action, token: getSessionToken() }, payload || {});
    const res = await fetch(conf.sheetsApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Request gagal');
    return j;
  }

  async function loadPpdbList() {
    const tbody = $('ppdbTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="ppdb-empty">Memuat data…</td></tr>';
    try {
      const j = await ppdbApi('listPpdb');
      ppdbRows = j.rows || [];
      renderPpdbTable();
      status('✓ Data PPDB dimuat (' + ppdbRows.length + ' pendaftar)');
      // Tandai notifikasi sudah dibaca (lonceng hilang di website)
      try {
        await ppdbApi('markPpdbRead');
        try { sessionStorage.removeItem('sdit_di_ppdb_focus'); } catch (_) {}
      } catch (_) {}
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="ppdb-empty">Gagal memuat: ' + escapeHtml(e.message) + '<br><span class="hint">Pastikan Apps Script sudah di-redeploy dengan endpoint listPpdb.</span></td></tr>';
      status('✗ Gagal muat PPDB: ' + e.message);
    }
  }

  function filteredPpdbRows() {
    const q = (($('ppdbSearch') && $('ppdbSearch').value) || '').trim().toLowerCase();
    const st = (($('ppdbFilterStatus') && $('ppdbFilterStatus').value) || '').trim();
    return ppdbRows.filter((r) => {
      if (st && String(r.status || '') !== st) return false;
      if (!q) return true;
      const hay = [r.id, r.nama_lengkap, r.nik, r.no_hp, r.ayah_nama, r.ibu_nama].map((x) => String(x || '').toLowerCase()).join(' ');
      return hay.indexOf(q) !== -1;
    });
  }

  function formatPpdbDate(v) {
    if (!v) return '—';
    try {
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v).slice(0, 16);
      return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return String(v); }
  }

  function statusBadge(s) {
    const v = String(s || 'Baru');
    const cls = v.toLowerCase().replace(/\s+/g, '');
    return '<span class="badge-status ' + escapeHtml(cls) + '">' + escapeHtml(v) + '</span>';
  }

  function renderPpdbTable() {
    const tbody = $('ppdbTableBody');
    const count = $('ppdbCount');
    if (!tbody) return;
    const rows = filteredPpdbRows();
    if (count) count.textContent = rows.length + ' / ' + ppdbRows.length + ' data';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="ppdb-empty">' + (ppdbRows.length ? 'Tidak ada yang cocok dengan filter.' : 'Belum ada pendaftaran.') + '</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((r) => {
      const id = escapeHtml(String(r.id || ''));
      return '<tr data-ppdb-id="' + id + '">' +
        '<td class="mono">' + id + '</td>' +
        '<td>' + escapeHtml(formatPpdbDate(r.submitted_at)) + '</td>' +
        '<td><strong>' + escapeHtml(r.nama_lengkap || '—') + '</strong></td>' +
        '<td class="mono">' + escapeHtml(r.nik || '—') + '</td>' +
        '<td>' + escapeHtml(r.jenis_kelamin || '—') + '</td>' +
        '<td>' + escapeHtml([r.tempat_lahir, r.tanggal_lahir].filter(Boolean).join(', ') || '—') + '</td>' +
        '<td>' + escapeHtml(r.ayah_nama || r.ibu_nama || '—') + '<div class="meta">' + escapeHtml(r.no_hp || '') + '</div></td>' +
        '<td>' + statusBadge(r.status) + '</td>' +
        '<td class="ppdb-actions-cell">' +
          '<button type="button" class="btn btn-ghost" data-ppdb-act="view" data-id="' + id + '">Detail</button>' +
          '<button type="button" class="btn btn-ghost" data-ppdb-act="print" data-id="' + id + '">PDF</button>' +
          '<button type="button" class="btn btn-ghost" data-ppdb-act="del" data-id="' + id + '" style="color:#b91c1c">Hapus</button>' +
        '</td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-ppdb-act]').forEach((btn) => {
      btn.onclick = () => {
        const act = btn.getAttribute('data-ppdb-act');
        const id = btn.getAttribute('data-id');
        if (act === 'view') openPpdbModal(id);
        else if (act === 'print') {
          const row = ppdbRows.find((x) => String(x.id) === String(id));
          if (row) printPpdbPdf(row);
        } else if (act === 'del') deletePpdbRow(id);
      };
    });
  }

  function openPpdbModal(id) {
    const modal = $('ppdbModal');
    const body = $('ppdbModalBody');
    const title = $('ppdbModalTitle');
    if (!modal || !body) return;

    let row = null;
    if (id === '__new__') {
      ppdbEditId = null;
      row = {
        status: 'Baru',
        tahun_ajaran: (data && data.ppdb && data.ppdb.year) || '2026/2027',
        agama: 'Islam',
        kewarganegaraan: 'WNI',
        provinsi: 'Jawa Barat',
        jenjang: 'SD',
        sekolah: 'SDIT Daarul Istiqomah',
        npsn: '70045471'
      };
      if (title) title.textContent = 'Tambah Pendaftaran Manual';
    } else {
      row = ppdbRows.find((x) => String(x.id) === String(id));
      if (!row) { status('Data tidak ditemukan'); return; }
      ppdbEditId = String(id);
      if (title) title.textContent = 'Detail / Edit — ' + (row.nama_lengkap || id);
    }

    body.innerHTML = '<div class="ppdb-modal-grid">' + PPDB_FIELDS.map((f) => {
      const val = row[f.key] != null ? String(row[f.key]) : '';
      const full = f.full ? ' full' : '';
      const ro = f.ro ? ' readonly' : '';
      let input;
      if (f.type === 'select') {
        const opts = (f.options || []).map((o) =>
          '<option value="' + escapeHtml(o) + '"' + (val === o ? ' selected' : '') + '>' + escapeHtml(o) + '</option>'
        ).join('');
        input = '<select id="ppdb_f_' + f.key + '"' + ro + '>' + opts + '</select>';
      } else if (f.type === 'textarea') {
        input = '<textarea id="ppdb_f_' + f.key + '" rows="2"' + ro + '>' + escapeHtml(val) + '</textarea>';
      } else {
        const t = f.type === 'date' ? 'date' : 'text';
        input = '<input type="' + t + '" id="ppdb_f_' + f.key + '" value="' + escapeHtml(val) + '"' + ro + '>';
      }
      return '<div class="' + full + '"><label>' + escapeHtml(f.label) + '</label>' + input + '</div>';
    }).join('') + '</div>';

    modal.hidden = false;
  }

  function closePpdbModal() {
    const modal = $('ppdbModal');
    if (modal) modal.hidden = true;
    ppdbEditId = null;
  }

  function readPpdbModalForm() {
    const out = {};
    PPDB_FIELDS.forEach((f) => {
      const el = document.getElementById('ppdb_f_' + f.key);
      if (el) out[f.key] = el.value.trim();
    });
    return out;
  }

  async function savePpdbModal() {
    const formData = readPpdbModalForm();
    if (!formData.nama_lengkap) { status('Nama lengkap wajib'); return; }
    if (!formData.nik || !/^[0-9]{16}$/.test(formData.nik)) { status('NIK harus 16 digit'); return; }

    try {
      if (ppdbEditId) {
        formData.id = ppdbEditId;
        await ppdbApi('updatePpdb', { data: formData });
        status('✓ Data PPDB diperbarui');
      } else {
        // create via submitPpdb
        formData.persetujuan = 'Ya';
        formData.submitted_at = new Date().toISOString();
        const j = await ppdbApi('submitPpdb', { data: formData });
        status('✓ Pendaftaran ditambahkan (' + (j.id || '') + ')');
      }
      closePpdbModal();
      await loadPpdbList();
    } catch (e) {
      status('✗ Gagal simpan: ' + e.message);
    }
  }

  async function deletePpdbRow(id) {
    if (!id) return;
    const ok = await themedConfirm('Hapus pendaftaran ' + id + '? Tindakan ini tidak bisa dibatalkan.');
    if (!ok) return;
    try {
      await ppdbApi('deletePpdb', { id: id });
      status('✓ Data dihapus');
      closePpdbModal();
      await loadPpdbList();
    } catch (e) {
      status('✗ Gagal hapus: ' + e.message);
    }
  }

  function downloadPpdbCsv() {
    const rows = filteredPpdbRows();
    if (!rows.length) { status('Tidak ada data untuk diunduh'); return; }
    const headers = PPDB_FIELDS.map((f) => f.key);
    // also include fixed meta fields
    const extra = ['jenjang', 'sekolah', 'npsn', 'persetujuan', 'source_url'];
    extra.forEach((h) => { if (headers.indexOf(h) === -1) headers.push(h); });

    function csvEscape(v) {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    const lines = [headers.join(',')];
    rows.forEach((r) => {
      lines.push(headers.map((h) => csvEscape(r[h])).join(','));
    });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ppdb-sdit-daarul-istiqomah-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    status('✓ CSV diunduh (' + rows.length + ' baris)');
  }

  function printPpdbPdf(row) {
    if (!row) return;
    const school = (data && data.school) || {};
    const schoolName = school.fullName || school.name || 'SDIT Daarul Istiqomah';
    const addr = school.address || '';
    const npsn = school.npsn || row.npsn || '70045471';
    const year = row.tahun_ajaran || (data && data.ppdb && data.ppdb.year) || '2026/2027';

    function cell(label, val) {
      return '<div class="f"><span class="l">' + label + '</span><span class="v">' + (val != null && val !== '' ? String(val) : '—') + '</span></div>';
    }
    function section(title, inner) {
      return '<div class="sec"><h2>' + title + '</h2><div class="grid">' + inner + '</div></div>';
    }

    const jk = row.jenis_kelamin === 'L' ? 'Laki-laki' : (row.jenis_kelamin === 'P' ? 'Perempuan' : (row.jenis_kelamin || '—'));
    const alamat = [row.alamat_jalan, (row.rt || row.rw) ? ('RT ' + (row.rt || '—') + '/RW ' + (row.rw || '—')) : '', row.desa_kelurahan, row.kecamatan, row.kabupaten_kota, row.provinsi, row.kode_pos].filter(Boolean).join(', ');

    const html = `<!DOCTYPE html>
<html lang="id"><head>
<meta charset="UTF-8">
<title>Formulir PPDB — ${escapeHtml(row.nama_lengkap || row.id || '')}</title>
<style>
  @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Tahoma, Arial, sans-serif;
    color: #1a1f2c;
    font-size: 10.5pt;
    line-height: 1.35;
    margin: 0;
  }
  .sheet { max-width: 190mm; margin: 0 auto; }
  .head {
    display: flex; align-items: flex-start; gap: 14px;
    border-bottom: 3px solid #0B6E4F; padding-bottom: 10px; margin-bottom: 12px;
  }
  .logo {
    width: 58px; height: 58px; object-fit: contain;
    border-radius: 8px; border: 1px solid #dce8e2;
  }
  .head-text { flex: 1; }
  .head-text h1 {
    margin: 0; font-size: 14pt; color: #084C37; letter-spacing: .02em;
  }
  .head-text .sub { margin: 2px 0 0; font-size: 9pt; color: #5B6575; }
  .head-text .title-form {
    margin-top: 6px; font-size: 12pt; font-weight: 800; color: #1a1f2c;
    text-transform: uppercase; letter-spacing: .04em;
  }
  .meta-bar {
    display: flex; flex-wrap: wrap; gap: 8px 18px;
    background: #f3faf6; border: 1px solid #cfe5da; border-radius: 6px;
    padding: 7px 10px; margin-bottom: 12px; font-size: 9.5pt;
  }
  .meta-bar strong { color: #084C37; }
  .sec { margin-bottom: 10px; page-break-inside: avoid; }
  .sec h2 {
    margin: 0 0 6px; font-size: 10pt; color: #fff; background: #0B6E4F;
    padding: 4px 8px; border-radius: 4px; letter-spacing: .03em;
  }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
  .f { display: flex; gap: 6px; padding: 2px 0; border-bottom: 1px dotted #d5e0da; align-items: baseline; }
  .f.full { grid-column: 1 / -1; }
  .l { flex: 0 0 42%; max-width: 160px; color: #5B6575; font-size: 8.5pt; }
  .v { flex: 1; font-weight: 600; color: #1a1f2c; word-break: break-word; }
  .sign {
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    margin-top: 18px; page-break-inside: avoid;
  }
  .sign .box { text-align: center; font-size: 9.5pt; }
  .sign .space { height: 56px; }
  .foot {
    margin-top: 14px; padding-top: 8px; border-top: 1px solid #cfe5da;
    font-size: 8pt; color: #5B6575; display: flex; justify-content: space-between;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
</style>
</head><body>
<div class="sheet">
  <div class="head">
    <img class="logo" src="../images/logo.jpg" alt="Logo" onerror="this.style.display='none'">
    <div class="head-text">
      <h1>${escapeHtml(schoolName)}</h1>
      <p class="sub">${escapeHtml(addr)}</p>
      <p class="sub">NPSN: ${escapeHtml(String(npsn))} · Domain: sditdaarulistiqomah.sch.id</p>
      <div class="title-form">Formulir Pendaftaran Peserta Didik Baru (PPDB)</div>
    </div>
  </div>

  <div class="meta-bar">
    <div><strong>No. Registrasi:</strong> ${escapeHtml(row.id || '—')}</div>
    <div><strong>Tahun Ajaran:</strong> ${escapeHtml(year)}</div>
    <div><strong>Status:</strong> ${escapeHtml(row.status || 'Baru')}</div>
    <div><strong>Tanggal Daftar:</strong> ${escapeHtml(formatPpdbDate(row.submitted_at))}</div>
  </div>

  ${section('A. Identitas Calon Peserta Didik',
    cell('Nama Lengkap', row.nama_lengkap) +
    cell('NIK', row.nik) +
    cell('NISN', row.nisn) +
    cell('No. Akta Kelahiran', row.no_akta_lahir) +
    cell('Tempat, Tanggal Lahir', [row.tempat_lahir, row.tanggal_lahir].filter(Boolean).join(', ')) +
    cell('Jenis Kelamin', jk) +
    cell('Agama', row.agama) +
    cell('Kewarganegaraan', row.kewarganegaraan) +
    cell('Anak ke-', row.anak_ke) +
    cell('Jumlah Saudara', row.jumlah_saudara) +
    cell('Berkebutuhan Khusus', row.kebutuhan_khusus)
  )}

  ${section('B. Alamat Tempat Tinggal',
    '<div class="f full"><span class="l">Alamat Lengkap</span><span class="v">' + escapeHtml(alamat || '—') + '</span></div>' +
    cell('Jarak ke Sekolah', row.jarak_km ? row.jarak_km + ' km' : '') +
    cell('Transportasi', row.transportasi)
  )}

  ${section('C. Pendidikan Sebelumnya',
    cell('Asal TK/PAUD/RA', row.asal_sekolah) +
    cell('Alamat Asal Sekolah', row.asal_sekolah_alamat) +
    cell('Tahun Lulus', row.tahun_lulus_asal)
  )}

  ${section('D. Data Ayah Kandung',
    cell('Nama Ayah', row.ayah_nama) +
    cell('NIK Ayah', row.ayah_nik) +
    cell('Pendidikan', row.ayah_pendidikan) +
    cell('Pekerjaan', row.ayah_pekerjaan) +
    cell('Penghasilan', row.ayah_penghasilan)
  )}

  ${section('E. Data Ibu Kandung',
    cell('Nama Ibu', row.ibu_nama) +
    cell('NIK Ibu', row.ibu_nik) +
    cell('Pendidikan', row.ibu_pendidikan) +
    cell('Pekerjaan', row.ibu_pekerjaan) +
    cell('Penghasilan', row.ibu_penghasilan)
  )}

  ${section('F. Wali & Kontak',
    cell('Nama Wali', row.wali_nama) +
    cell('Hubungan', row.wali_hubungan) +
    cell('No. HP / WhatsApp', row.no_hp) +
    cell('Email', row.email_ortu)
  )}

  ${section('G. Informasi Tambahan',
    cell('Minat Program', row.minat_program) +
    cell('Tinggi / Berat', [row.tinggi_badan ? row.tinggi_badan + ' cm' : '', row.berat_badan ? row.berat_badan + ' kg' : ''].filter(Boolean).join(' / ')) +
    '<div class="f full"><span class="l">Catatan</span><span class="v">' + escapeHtml(row.catatan || '—') + '</span></div>'
  )}

  <div class="sign">
    <div class="box">
      <div>Mengetahui,<br>Orang Tua / Wali</div>
      <div class="space"></div>
      <div><strong>${escapeHtml(row.ayah_nama || row.ibu_nama || row.wali_nama || '............................')}</strong></div>
    </div>
    <div class="box">
      <div>Tajurhalang, ........................<br>Petugas PPDB</div>
      <div class="space"></div>
      <div><strong>............................</strong></div>
    </div>
  </div>

  <div class="foot">
    <span>Dokumen ini dicetak dari sistem PPDB online SDIT Daarul Istiqomah · ${escapeHtml(new Date().toLocaleString('id-ID'))}</span>
    <span>${escapeHtml(row.id || '')}</span>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
</body></html>`;

    const w = window.open('', '_blank', 'noopener,width=900,height=1000');
    if (!w) {
      status('Pop-up diblokir. Izinkan pop-up untuk cetak PDF.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // Wire PPDB UI
  const btnPpdbRefresh = $('btnPpdbRefresh');
  if (btnPpdbRefresh) btnPpdbRefresh.onclick = () => loadPpdbList();
  const btnPpdbDownload = $('btnPpdbDownload');
  if (btnPpdbDownload) btnPpdbDownload.onclick = () => downloadPpdbCsv();
  const btnPpdbAdd = $('btnPpdbAdd');
  if (btnPpdbAdd) btnPpdbAdd.onclick = () => openPpdbModal('__new__');
  const ppdbSearch = $('ppdbSearch');
  if (ppdbSearch) ppdbSearch.addEventListener('input', () => renderPpdbTable());
  const ppdbFilter = $('ppdbFilterStatus');
  if (ppdbFilter) ppdbFilter.addEventListener('change', () => renderPpdbTable());

  const btnPpdbModalSave = $('btnPpdbModalSave');
  if (btnPpdbModalSave) btnPpdbModalSave.onclick = () => savePpdbModal();
  const btnPpdbModalClose = $('btnPpdbModalClose');
  if (btnPpdbModalClose) btnPpdbModalClose.onclick = () => closePpdbModal();
  const btnPpdbModalPrint = $('btnPpdbModalPrint');
  if (btnPpdbModalPrint) btnPpdbModalPrint.onclick = () => {
    const formData = readPpdbModalForm();
    if (ppdbEditId) formData.id = ppdbEditId;
    printPpdbPdf(formData);
  };
  const btnPpdbModalDelete = $('btnPpdbModalDelete');
  if (btnPpdbModalDelete) btnPpdbModalDelete.onclick = () => {
    if (ppdbEditId) deletePpdbRow(ppdbEditId);
    else status('Simpan dulu sebelum menghapus, atau tutup form tambah.');
  };
  const ppdbModal = $('ppdbModal');
  if (ppdbModal) ppdbModal.addEventListener('click', (e) => { if (e.target.id === 'ppdbModal') closePpdbModal(); });


  // Deep-link from frontend quick-edit: admin/?edit=carousel:0


  /* ========== Admin horizontal tabs ========== */
  function setupAdminTabs() {
    const bar = document.getElementById('adminTabs');
    if (!bar) {
      console.warn('[admin] #adminTabs tidak ditemukan');
      return;
    }

    function activate(tabId) {
      if (!tabId) return;
      bar.querySelectorAll('.admin-tab').forEach((btn) => {
        const on = btn.getAttribute('data-tab') === tabId;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
        const on = panel.getAttribute('data-tab-panel') === tabId;
        panel.classList.toggle('active', on);
      });
      try {
        const u = new URL(location.href);
        u.searchParams.set('tab', tabId);
        history.replaceState({}, '', u.pathname + u.search + u.hash);
      } catch (_) {}
    }

    // Event delegation — lebih tahan jika DOM diganti
    if (!bar.dataset.tabsBound) {
      bar.dataset.tabsBound = '1';
      bar.addEventListener('click', (e) => {
        const btn = e.target.closest('.admin-tab');
        if (!btn || !bar.contains(btn)) return;
        e.preventDefault();
        activate(btn.getAttribute('data-tab'));
      });
    }

    // deep link ?tab=ppdb or ?focus=ppdb
    const params = new URLSearchParams(location.search);
    const initial = params.get('tab') || (params.get('focus') === 'ppdb' ? 'ppdb' : null);
    if (initial) activate(initial);

    window.__adminActivateTab = activate;
  }

  function focusPpdbSectionIfNeeded() {
    const params = new URLSearchParams(location.search);
    const need = params.get('focus') === 'ppdb' || sessionStorage.getItem('sdit_di_ppdb_focus') === '1';
    if (!need) return;
    if (typeof window.__adminActivateTab === 'function') window.__adminActivateTab('ppdb');
    const card = document.getElementById('ppdbDataCard');
    if (card) {
      setTimeout(() => {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.style.boxShadow = '0 0 0 3px rgba(201,162,39,.55), 0 8px 28px rgba(8,76,55,.12)';
        setTimeout(() => { card.style.boxShadow = ''; }, 2600);
      }, 500);
    }
    try {
      const u = new URL(location.href);
      u.searchParams.delete('focus');
      history.replaceState({}, '', u.pathname + u.search);
    } catch (_) {}
  }

  function handleDeepLinkEdit() {
    const params = new URLSearchParams(location.search);
    const edit = params.get('edit');
    if (!edit) return;
    const colon = edit.lastIndexOf(':');
    const type = colon >= 0 ? edit.slice(0, colon) : edit;
    const index = parseInt(colon >= 0 ? edit.slice(colon + 1) : '-1', 10);
    if (!type || Number.isNaN(index) || index < 0) return;

    const tabFor = {
      programs: 'profil', activities: 'profil', stats: 'profil',
      leadership: 'profil', carousel: 'carousel', articles: 'berita',
      gallery: 'galeri', videos: 'video', media: 'media',
      announcements: 'pengumuman', facilities: 'akademik', teachers: 'akademik',
      achievements: 'akademik', calendar: 'akademik', faq: 'ppdb',
      'ppdb.steps': 'ppdb', 'ppdb.schedule': 'ppdb', 'fees.items': 'ppdb'
    };

    const tryOpen = () => {
      if (!isAuthed() || !data) return false;
      // pastikan array ada
      try { getListRef(type); } catch (_) { return false; }
      const tab = tabFor[type];
      if (tab) {
        const btn = document.querySelector('.admin-tab[data-tab="' + tab + '"]');
        if (btn) btn.click();
      }
      openEditor(type, index);
      status('Membuka editor: ' + type + ' #' + (index + 1));
      try {
        const u = new URL(location.href);
        u.searchParams.delete('edit');
        history.replaceState({}, '', u.pathname + u.search);
      } catch (_) {}
      return true;
    };
    let n = 0;
    const t = setInterval(() => {
      n++;
      if (isAuthed() && data && tryOpen()) clearInterval(t);
      if (n > 40) clearInterval(t);
    }, 250);
  }
  
  // Announcements UI
  const btnAddAnn = $('btnAddAnn');
  if (btnAddAnn) btnAddAnn.onclick = () => openAnnEditor(-1);
  const btnAnnSave = $('btnAnnSave');
  if (btnAnnSave) btnAnnSave.onclick = saveAnnEditor;
  const btnAnnPreview = $('btnAnnPreview');
  if (btnAnnPreview) btnAnnPreview.onclick = previewAnnOnPublic;
  const btnAnnCancel = $('btnAnnCancel');
  if (btnAnnCancel) btnAnnCancel.onclick = closeAnnEditor;
  ['annTitle','annBody','annImage'].forEach((id) => {
    const n = $(id);
    if (n) n.addEventListener('input', updateAnnPreview);
  });
  const pasteZone = $('annPaste');
  if (pasteZone) {
    pasteZone.addEventListener('click', () => pasteZone.focus());
    pasteZone.addEventListener('paste', async (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const it of items) {
        if (it.type && it.type.indexOf('image') === 0) {
          e.preventDefault();
          const file = it.getAsFile();
          try {
            const dataUrl = await compressImageFile(file, 900, 0.7);
            if (dataUrl.length > 45000) {
              status('Screenshot masih besar setelah kompres. Coba crop dulu atau pakai URL gambar.');
            }
            $('annImage').value = dataUrl;
            updateAnnPreview();
            status('Screenshot ditempel ke pengumuman.');
          } catch (err) {
            status('Gagal memproses gambar clipboard.');
          }
          break;
        }
      }
    });
  }

  setupAdminTabs();
  handleDeepLinkEdit();
  window.addEventListener('beforeunload', (e) => {
    if (window.__siteDirty) { e.preventDefault(); e.returnValue = ''; }
  });
  if (isAuthed()) focusPpdbSectionIfNeeded();

  // Re-focus after login
  const _tryLoginOrig = tryLogin;
  // wrap: after successful login focus ppdb
  const _btnLogin = document.getElementById('btnLogin');
  if (_btnLogin) {
    _btnLogin.addEventListener('click', () => setTimeout(() => { if (isAuthed()) focusPpdbSectionIfNeeded(); }, 200));
  }

})();