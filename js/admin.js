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
  const ADMIN_PASS = 'Bismillaah9999#';

  function isAuthed() {
    try { return sessionStorage.getItem(AUTH_KEY) === '1'; } catch (_) { return false; }
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

  function grantAuth() {
    try { sessionStorage.setItem(AUTH_KEY, '1'); } catch (_) {}
    unlockAdmin();
  }

  function tryLogin() {
    const input = document.getElementById('loginPass');
    const pass = (input && input.value != null) ? String(input.value).trim() : '';
    const err = document.getElementById('loginErr');
    if (pass === ADMIN_PASS) {
      if (err) err.textContent = '';
      grantAuth();
    } else {
      if (err) err.textContent = 'Password salah. Coba lagi. (pastikan tanpa spasi di awal/akhir)';
      status('Password salah.');
      if (input) { input.focus(); input.select(); }
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
    try { sessionStorage.removeItem(AUTH_KEY); } catch (_) {}
    lockAdmin();
    const err = document.getElementById('loginErr');
    if (err) err.textContent = '';
    const pass = document.getElementById('loginPass');
    if (pass) pass.value = '';
    status('Anda telah keluar. Masukkan password untuk mengakses panel.');
  }

  // Paksa login setiap buka admin, kecuali deep-link edit dari frontend (sudah prompt password)
  const _deepEdit = new URLSearchParams(location.search).get('edit');
  if (!_deepEdit) {
    try { sessionStorage.removeItem(AUTH_KEY); } catch (_) {}
  }
  lockAdmin();

  const btnLogin = document.getElementById('btnLogin');
  const inpLogin = document.getElementById('loginPass');
  if (btnLogin) btnLogin.onclick = tryLogin;
  if (inpLogin) inpLogin.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });

  // Auto-unlock if deep-link + already authenticated from frontend prompt
  if (_deepEdit && isAuthed()) {
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
      el.innerHTML = 'Google Sheets: <strong>aktif</strong> — semua data website dibaca & disimpan ke Sheet (sumber tunggal).';
    } else {
      el.innerHTML = '⚠️ Google Sheets <strong>belum dikonfigurasi</strong>. Isi <code>sheetsApiUrl</code> + <code>apiToken</code> di <code>js/config.js</code> (lihat <code>apps-script/SETUP.md</code>). Tanpa ini data tidak tersimpan ke cloud.';
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
    fillForm();
    status('✓ Data dimuat dari Google Sheets');
    return true;
  }

  async function loadFromFile() {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    data = await res.json();
    if (!data.media) data.media = [];
    if (!data.announcements) data.announcements = [];
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
        return;
      } catch (e) {
        status('Sheets belum siap (' + e.message + '). Memuat site.json…');
        await loadFromFile();
        return;
      }
    }
    status('Peringatan: useSheets/sheetsApiUrl belum diisi. Memuat site.json.');
    await loadFromFile();
  }

  function fillForm() {
    if (!data) return;
    const s = data.school || {};
    $('fName').value = s.name || '';
    $('fTagline').value = s.tagline || '';
    $('fAddress').value = s.address || '';
    $('fEmail').value = s.email || '';
    $('fWa').value = s.whatsapp || '';
    const p = data.ppdb || {};
    $('fPpdbYear').value = p.year || '';
    $('fPpdbOpen').value = String(p.open !== false);
    $('fPpdbNote').value = p.note || '';
    renderLists();
  }

  function readForm() {
    if (!data.school) data.school = {};
    if (!data.ppdb) data.ppdb = {};
    data.school.name = $('fName').value.trim();
    data.school.tagline = $('fTagline').value.trim();
    data.school.address = $('fAddress').value.trim();
    data.school.email = $('fEmail').value.trim();
    data.school.whatsapp = $('fWa').value.trim();
    data.ppdb.year = $('fPpdbYear').value.trim();
    data.ppdb.open = $('fPpdbOpen').value === 'true';
    data.ppdb.note = $('fPpdbNote').value.trim();
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
    ]
  };

  function openEditor(type, index) {
    if (type === 'announcements') {
      openAnnEditor(index);
      return;
    }
    editCtx = { type, index };
    const list = data[type] || [];
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
    const item = index >= 0 ? Object.assign({}, (data[type] || [])[index]) : { id: type[0] + Date.now() };
    schema.forEach((f) => {
      const el = document.getElementById('ef_' + f.key);
      if (el) item[f.key] = el.value.trim();
    });
    if (!data[type]) data[type] = [];
    if (index >= 0) data[type][index] = item;
    else data[type].unshift(item);
    closeEditor();
    renderLists();
    status('Perubahan disimpan di form. Klik "Simpan ke Browser" agar permanen di sesi ini.');
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
    if (!(await themedConfirm('Hapus item ini? Tindakan ini hanya di memori sampai Anda klik Simpan ke Browser.'))) return;
    data[type].splice(index, 1);
    renderLists();
    status('Item dihapus. Klik Simpan ke Browser.');
  }

  function rowActions(type, index) {
    const wrap = document.createElement('div');
    wrap.className = 'actions-row';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn btn-primary';
    edit.textContent = 'Edit';
    edit.setAttribute('data-tip', 'Buka form untuk mengubah data item ini (judul, gambar, tautan, dll). Setelah edit, klik Simpan di form, lalu Simpan ke Browser.');
    edit.onclick = () => openEditor(type, index);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-ghost';
    del.textContent = 'Hapus';
    del.setAttribute('data-tip', 'Hapus item ini dari daftar. Perubahan belum permanen sampai Anda klik Simpan ke Browser atau Export JSON.');
    del.onclick = () => deleteItem(type, index);
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

  function renderLists() {
    renderAnnList();

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
    if (!(conf.useSheets && conf.sheetsApiUrl && conf.apiToken)) {
      status('✗ Belum dikonfigurasi: isi sheetsApiUrl + apiToken di js/config.js, lalu deploy ulang Apps Script.');
      return;
    }
    status('Menyimpan ke Google Sheets…');
    try {
      const res = await fetch(conf.sheetsApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveSite', token: conf.apiToken, data: data })
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'saveSite gagal');
      // clear public cache so frontend refetches
      try { localStorage.removeItem('sdit_di_site_cache_v2'); } catch (_) {}
      const cnt = j.counts || {};
      status('✓ Tersimpan ke Google Sheets · ' + (j.updatedAt || '') +
        ' · media:' + (cnt.media || 0) +
        ' carousel:' + (cnt.carousel || 0) +
        ' artikel:' + (cnt.articles || 0));
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
        body: JSON.stringify(Object.assign({ action: action, token: c.apiToken }, payload || {}))
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

  $('btnAddCarousel').onclick = () => openEditor('carousel', -1);
  $('btnAddArticle').onclick = () => openEditor('articles', -1);
  $('btnAddGallery').onclick = () => openEditor('gallery', -1);
  const bv = $('btnAddVideo'); if (bv) bv.onclick = () => openEditor('videos', -1);

  updateSheetsHint();
  (async () => {
    await loadPreferred();
  })();

  // Deep-link from frontend quick-edit: admin/?edit=carousel:0
  function handleDeepLinkEdit() {
    const params = new URLSearchParams(location.search);
    const edit = params.get('edit');
    if (!edit) return;
    const [type, idxStr] = edit.split(':');
    const index = parseInt(idxStr, 10);
    if (!type || Number.isNaN(index)) return;
    // Wait until unlocked & data loaded
    const tryOpen = () => {
      if (!isAuthed()) return;
      if (!data || !data[type]) return;
      openEditor(type, index);
      status('Membuka editor untuk ' + type + ' #' + (index + 1));
      // clean URL
      try {
        const u = new URL(location.href);
        u.searchParams.delete('edit');
        history.replaceState({}, '', u.pathname + u.search);
      } catch (_) {}
    };
    // Poll briefly until auth + data ready
    let n = 0;
    const t = setInterval(() => {
      n++;
      if (isAuthed() && data) { clearInterval(t); tryOpen(); }
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

  handleDeepLinkEdit();

})();