/**
 * SDIT Daarul Istiqomah — Google Apps Script API
 * ------------------------------------------------
 * Deploy sebagai Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Sheet:
 *   1) site   — snapshot JSON penuh (SUMBER UTAMA)
 *   2) media  — mirror daftar media
 *
 * Header site: key | json | updated_at
 * Header media: id | url | type | source | shortcode | title | description | category | thumb | embedUrl | active | date | created_by
 */

var SHEET_SITE = 'site';
var SHEET_MEDIA = 'media';
var SHEET_PPDB = 'ppdb';
var CACHE_SECONDS = 30;

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    var action = (e.parameter && e.parameter.action) || 'getSite';
    var body = {};
    if (method === 'POST' && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
      if (body.action) action = body.action;
    }

    var token = PropertiesService.getScriptProperties().getProperty('API_TOKEN') || '';
    var publicActions = { list: 1, getSite: 1, ping: 1, publish: 1, getEngagement: 1, like: 1, comment: 1, submitPpdb: 1, getPpdbNotif: 1, adminLogin: 1 };
    if (!publicActions[action]) {
      var clientToken = (e.parameter && e.parameter.token) || body.token || '';
      // WAJIB: API_TOKEN harus ter-set; tanpa token server → tolak semua aksi tulis
      if (!token) {
        return json_({ ok: false, error: 'Unauthorized — API_TOKEN belum di-set di Script properties' });
      }
      if (!clientToken || clientToken !== token) {
        return json_({ ok: false, error: 'Unauthorized — token salah atau sesi tidak valid' });
      }
    }

    if (action === 'ping') {
      return json_({ ok: true, service: 'sdit-di', ts: new Date().toISOString() });
    }
    if (action === 'adminLogin') {
      return json_(adminLogin_(body.password || (e.parameter && e.parameter.password) || ''));
    }
    if (action === 'getSite') {
      return json_({ ok: true, data: getSite_(), source: 'google-sheets', ts: new Date().toISOString() });
    }
    if (action === 'saveSite') {
      return json_(saveSite_(body.data || body.site || body));
    }
    if (action === 'list') {
      var site = getSite_();
      var media = (site && site.media) ? site.media : listMedia_();
      return json_({ ok: true, media: media, source: 'google-sheets' });
    }
    if (action === 'add') return json_(addMedia_(body.item || body));
    if (action === 'update') return json_(updateMedia_(body.item || body));
    if (action === 'delete') return json_(deleteMedia_(body.id || (e.parameter && e.parameter.id)));
    if (action === 'publish') return json_({ ok: true, data: getSite_(), generatedAt: new Date().toISOString() });
    if (action === 'getEngagement') {
      return json_({ ok: true, stats: getEngagement_(body.targetType || (e.parameter && e.parameter.targetType), body.targetId || (e.parameter && e.parameter.targetId)) });
    }
    if (action === 'like') {
      return json_(addLike_({
        targetType: body.targetType || (e.parameter && e.parameter.targetType),
        targetId: body.targetId || (e.parameter && e.parameter.targetId),
        fingerprint: body.fingerprint || (e.parameter && e.parameter.fingerprint) || ''
      }));
    }
    if (action === 'comment') {
      return json_(addComment_({
        targetType: body.targetType || (e.parameter && e.parameter.targetType),
        targetId: body.targetId || (e.parameter && e.parameter.targetId),
        author: body.author || (e.parameter && e.parameter.author) || 'Anonim',
        message: body.message || (e.parameter && e.parameter.message) || '',
        fingerprint: body.fingerprint || (e.parameter && e.parameter.fingerprint) || ''
      }));
    }

    if (action === 'submitPpdb') {
      return json_(submitPpdb_(body.data || body));
    }
    if (action === 'listPpdb') {
      return json_({ ok: true, rows: listPpdb_() });
    }
    if (action === 'updatePpdb') {
      return json_(updatePpdb_(body.data || body));
    }
    if (action === 'deletePpdb') {
      return json_(deletePpdb_(body.id || (e.parameter && e.parameter.id)));
    }
    if (action === 'getPpdbNotif') {
      return json_(getPpdbNotif_());
    }
    if (action === 'markPpdbRead') {
      return json_(markPpdbRead_());
    }

    return json_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function getSite_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('site_json');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  var sheet = getSheet_(SHEET_SITE);
  ensureSiteHeaders_(sheet);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === 'site' && values[i][1]) {
      try {
        var data = JSON.parse(String(values[i][1]));
        cache.put('site_json', JSON.stringify(data), CACHE_SECONDS);
        return data;
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

function saveSite_(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'data site wajib (object JSON)' };
  }
  if (!data.media) data.media = [];
  if (!data.carousel) data.carousel = [];
  if (!data.articles) data.articles = [];
  if (!data.gallery) data.gallery = [];
  if (!data.videos) data.videos = [];
  if (!data.facilities) data.facilities = [];
  if (!data.teachers) data.teachers = [];
  if (!data.achievements) data.achievements = [];
  if (!data.leadership) data.leadership = [];
  if (!data.calendar) data.calendar = [];
  if (!data.faq) data.faq = [];
  if (!data.visionMission) data.visionMission = { vision: '', mission: [], motto: '' };
  if (!data.fees) data.fees = { enabled: false, title: '', note: '', items: [] };
  if (!data.complaint) data.complaint = { enabled: false };

  var sheet = getSheet_(SHEET_SITE);
  ensureSiteHeaders_(sheet);
  var values = sheet.getDataRange().getValues();
  var jsonStr = JSON.stringify(data);
  var now = new Date().toISOString();
  var found = false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === 'site') {
      sheet.getRange(i + 1, 2).setValue(jsonStr);
      sheet.getRange(i + 1, 3).setValue(now);
      found = true;
      break;
    }
  }
  if (!found) {
    sheet.appendRow(['site', jsonStr, now]);
  }

  try { syncMediaSheet_(data.media || []); } catch (e) {}

  CacheService.getScriptCache().remove('site_json');
  CacheService.getScriptCache().remove('media_list');

  return {
    ok: true,
    updatedAt: now,
    counts: {
      media: (data.media || []).length,
      carousel: (data.carousel || []).length,
      articles: (data.articles || []).length,
      gallery: (data.gallery || []).length,
      videos: (data.videos || []).length,
      facilities: (data.facilities || []).length,
      teachers: (data.teachers || []).length,
      achievements: (data.achievements || []).length,
      leadership: (data.leadership || []).length,
      calendar: (data.calendar || []).length,
      faq: (data.faq || []).length
    }
  };
}

function ensureSiteHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['key', 'json', 'updated_at']);
  }
}

function syncMediaSheet_(mediaList) {
  var sheet = getSheet_(SHEET_MEDIA);
  ensureHeaders_(sheet);
  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last, 13).clearContent();
  if (!mediaList || !mediaList.length) return;
  var rows = mediaList.map(function (item) {
    return [
      item.id || '',
      item.url || '',
      item.type || 'foto',
      item.source || '',
      item.shortcode || '',
      item.title || '',
      item.description || '',
      item.category || '',
      item.thumb || '',
      item.embedUrl || '',
      item.active !== false ? 'TRUE' : 'FALSE',
      item.date || '',
      item.created_by || ''
    ];
  });
  if (rows.length) {
    sheet.getRange(2, 1, 1 + rows.length, 13).setValues(rows);
  }
}

function listMedia_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('media_list');
  if (cached) return JSON.parse(cached);

  var sheet = getSheet_(SHEET_MEDIA);
  ensureHeaders_(sheet);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(String);
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row[0]) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    obj.active = String(obj.active).toUpperCase() !== 'FALSE' && obj.active !== false && obj.active !== 0;
    rows.push(obj);
  }
  cache.put('media_list', JSON.stringify(rows), CACHE_SECONDS);
  return rows;
}

function addMedia_(item) {
  if (!item || !item.url) return { ok: false, error: 'url wajib' };
  var site = getSite_() || { media: [] };
  if (!site.media) site.media = [];
  item.id = item.id || ('m' + new Date().getTime());
  site.media.unshift(item);
  return saveSite_(site);
}

function updateMedia_(item) {
  if (!item || !item.id) return { ok: false, error: 'id wajib' };
  var site = getSite_() || { media: [] };
  var list = site.media || [];
  var found = false;
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === String(item.id)) {
      for (var k in item) {
        if (item.hasOwnProperty(k)) list[i][k] = item[k];
      }
      found = true;
      break;
    }
  }
  if (!found) return { ok: false, error: 'id tidak ditemukan' };
  site.media = list;
  return saveSite_(site);
}

function deleteMedia_(id) {
  if (!id) return { ok: false, error: 'id wajib' };
  var site = getSite_() || { media: [] };
  var before = (site.media || []).length;
  site.media = (site.media || []).filter(function (m) {
    return String(m.id) !== String(id);
  });
  if (site.media.length === before) return { ok: false, error: 'id tidak ditemukan' };
  return saveSite_(site);
}

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'id', 'url', 'type', 'source', 'shortcode', 'title', 'description',
      'category', 'thumb', 'embedUrl', 'active', 'date', 'created_by'
    ]);
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}



/* ========== ENGAGEMENT (like + comment) ========== */
var SHEET_ENGAGE = 'engagement';

function ensureEngageHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['id', 'targetType', 'targetId', 'kind', 'author', 'message', 'fingerprint', 'created_at']);
  }
}

function getEngagement_(targetType, targetId) {
  if (!targetType || !targetId) return { likes: 0, comments: [] };
  var sheet = getSheet_(SHEET_ENGAGE);
  ensureEngageHeaders_(sheet);
  var values = sheet.getDataRange().getValues();
  var likes = 0;
  var comments = [];
  var likedFp = {};
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[1]) !== String(targetType) || String(row[2]) !== String(targetId)) continue;
    var kind = String(row[3]);
    if (kind === 'like') {
      likes++;
      if (row[6]) likedFp[String(row[6])] = true;
    } else if (kind === 'comment') {
      comments.push({
        id: row[0],
        author: row[4] || 'Anonim',
        message: row[5] || '',
        created_at: row[7] || ''
      });
    }
  }
  // newest first
  comments = comments.reverse().slice(0, 50);
  return { likes: likes, comments: comments };
}

function addLike_(body) {
  var targetType = body.targetType;
  var targetId = body.targetId;
  var fp = body.fingerprint || '';
  if (!targetType || !targetId) return { ok: false, error: 'target wajib' };
  var sheet = getSheet_(SHEET_ENGAGE);
  ensureEngageHeaders_(sheet);
  // prevent duplicate like same fingerprint
  if (fp) {
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][1]) === String(targetType) && String(values[i][2]) === String(targetId)
          && String(values[i][3]) === 'like' && String(values[i][6]) === String(fp)) {
        return { ok: true, duplicate: true, stats: getEngagement_(targetType, targetId) };
      }
    }
  }
  var id = 'lk' + new Date().getTime();
  sheet.appendRow([id, targetType, targetId, 'like', '', '', fp, new Date().toISOString()]);
  return { ok: true, stats: getEngagement_(targetType, targetId) };
}

function addComment_(body) {
  var targetType = body.targetType;
  var targetId = body.targetId;
  var message = (body.message || '').toString().trim();
  var author = (body.author || 'Anonim').toString().trim().slice(0, 40);
  if (!targetType || !targetId) return { ok: false, error: 'target wajib' };
  if (!message || message.length < 2) return { ok: false, error: 'komentar terlalu pendek' };
  if (message.length > 500) return { ok: false, error: 'komentar max 500 karakter' };
  var sheet = getSheet_(SHEET_ENGAGE);
  ensureEngageHeaders_(sheet);
  var id = 'cm' + new Date().getTime();
  sheet.appendRow([id, targetType, targetId, 'comment', author, message, body.fingerprint || '', new Date().toISOString()]);
  return { ok: true, stats: getEngagement_(targetType, targetId) };
}


/* ========== PPDB Registrations (Dapodik-ready export) ========== */
var PPDB_HEADERS = [
  'id', 'submitted_at', 'tahun_ajaran', 'jenjang', 'sekolah', 'npsn', 'status',
  'nama_lengkap', 'nik', 'nisn', 'no_akta_lahir', 'tempat_lahir', 'tanggal_lahir',
  'jenis_kelamin', 'agama', 'kewarganegaraan', 'anak_ke', 'jumlah_saudara', 'kebutuhan_khusus',
  'alamat_jalan', 'rt', 'rw', 'desa_kelurahan', 'kecamatan', 'kabupaten_kota', 'provinsi', 'kode_pos',
  'jarak_km', 'transportasi',
  'asal_sekolah', 'asal_sekolah_alamat', 'tahun_lulus_asal',
  'ayah_nama', 'ayah_nik', 'ayah_pendidikan', 'ayah_pekerjaan', 'ayah_penghasilan',
  'ibu_nama', 'ibu_nik', 'ibu_pendidikan', 'ibu_pekerjaan', 'ibu_penghasilan',
  'wali_nama', 'wali_hubungan', 'no_hp', 'email_ortu',
  'minat_program', 'tinggi_badan', 'berat_badan', 'catatan',
  'persetujuan', 'source_url', 'user_agent'
];

function ensurePpdbHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(PPDB_HEADERS);
  } else {
    var first = sheet.getRange(1, 1, 1, PPDB_HEADERS.length).getValues()[0];
    if (String(first[0]) !== 'id') {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, PPDB_HEADERS.length).setValues([PPDB_HEADERS]);
    }
  }
}

function submitPpdb_(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'data formulir wajib' };
  }
  var nama = (data.nama_lengkap || '').toString().trim();
  var nik = (data.nik || '').toString().trim();
  if (!nama || nama.length < 3) return { ok: false, error: 'nama_lengkap wajib' };
  if (!/^[0-9]{16}$/.test(nik)) return { ok: false, error: 'NIK harus 16 digit' };
  if (!(data.ayah_nama || '').toString().trim()) return { ok: false, error: 'ayah_nama wajib' };
  if (!(data.ibu_nama || '').toString().trim()) return { ok: false, error: 'ibu_nama wajib' };
  if (!(data.no_hp || '').toString().trim()) return { ok: false, error: 'no_hp wajib' };

  var sheet = getSheet_(SHEET_PPDB);
  ensurePpdbHeaders_(sheet);

  // Cegah duplikat NIK dalam 30 hari
  var values = sheet.getDataRange().getValues();
  var nikCol = PPDB_HEADERS.indexOf('nik');
  var dateCol = PPDB_HEADERS.indexOf('submitted_at');
  var now = new Date();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][nikCol]) === nik) {
      var prev = values[i][dateCol] ? new Date(values[i][dateCol]) : null;
      if (prev && (now - prev) < 30 * 24 * 3600 * 1000) {
        return { ok: false, error: 'NIK sudah terdaftar dalam 30 hari terakhir. Hubungi panitia jika perlu perbaikan data.' };
      }
    }
  }

  var id = 'PPDB-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMdd') + '-' + String(now.getTime()).slice(-6);
  data.id = id;
  data.submitted_at = data.submitted_at || now.toISOString();
  data.status = data.status || 'Baru';
  data.tahun_ajaran = data.tahun_ajaran || '2026/2027';
  data.jenjang = data.jenjang || 'SD';
  data.sekolah = data.sekolah || 'SDIT Daarul Istiqomah';
  data.npsn = data.npsn || '70045471';

  var row = PPDB_HEADERS.map(function (h) {
    var v = data[h];
    if (v === undefined || v === null) return '';
    return String(v).slice(0, h === 'user_agent' || h === 'catatan' ? 500 : 200);
  });
  sheet.appendRow(row);

  // Notifikasi admin (lonceng + email opsional)
  try { bumpPpdbNotif_(id, nama); } catch (e) {}
  try { maybeEmailPpdb_(id, data); } catch (e) {}

  return {
    ok: true,
    id: id,
    registrationId: id,
    message: 'Pendaftaran berhasil. Simpan nomor registrasi Anda.',
    submitted_at: data.submitted_at
  };
}

function listPpdb_() {
  var sheet = getSheet_(SHEET_PPDB);
  ensurePpdbHeaders_(sheet);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(String);
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[i][j];
    }
    if (obj.id) rows.push(obj);
  }
  return rows.reverse();
}



function updatePpdb_(data) {
  if (!data || !data.id) return { ok: false, error: 'id wajib' };
  var sheet = getSheet_(SHEET_PPDB);
  ensurePpdbHeaders_(sheet);
  var values = sheet.getDataRange().getValues();
  var idCol = 0;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(data.id)) {
      var row = PPDB_HEADERS.map(function (h) {
        var v = data[h];
        if (v === undefined || v === null) {
          // keep existing if not provided
          var col = PPDB_HEADERS.indexOf(h);
          return col >= 0 ? values[i][col] : '';
        }
        return String(v).slice(0, h === 'user_agent' || h === 'catatan' ? 500 : 200);
      });
      sheet.getRange(i + 1, 1, 1, PPDB_HEADERS.length).setValues([row]);
      return { ok: true, id: data.id, message: 'Data diperbarui' };
    }
  }
  return { ok: false, error: 'ID tidak ditemukan: ' + data.id };
}

function deletePpdb_(id) {
  if (!id) return { ok: false, error: 'id wajib' };
  var sheet = getSheet_(SHEET_PPDB);
  ensurePpdbHeaders_(sheet);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { ok: true, id: id, message: 'Data dihapus' };
    }
  }
  return { ok: false, error: 'ID tidak ditemukan: ' + id };
}


/* ========== Notifikasi PPDB (lonceng + email) ========== */
function bumpPpdbNotif_(id, nama) {
  var props = PropertiesService.getScriptProperties();
  var count = parseInt(props.getProperty('PPDB_UNREAD') || '0', 10) || 0;
  count++;
  props.setProperty('PPDB_UNREAD', String(count));
  props.setProperty('PPDB_LAST_ID', String(id || ''));
  props.setProperty('PPDB_LAST_NAME', String(nama || '').slice(0, 80));
  props.setProperty('PPDB_LAST_AT', new Date().toISOString());
}

function getPpdbNotif_() {
  var props = PropertiesService.getScriptProperties();
  var count = parseInt(props.getProperty('PPDB_UNREAD') || '0', 10) || 0;
  return {
    ok: true,
    count: count,
    lastId: props.getProperty('PPDB_LAST_ID') || '',
    lastName: props.getProperty('PPDB_LAST_NAME') || '',
    lastAt: props.getProperty('PPDB_LAST_AT') || ''
  };
}

function markPpdbRead_() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('PPDB_UNREAD', '0');
  return { ok: true, count: 0, message: 'Notifikasi PPDB ditandai sudah dibaca' };
}

function maybeEmailPpdb_(id, data) {
  var props = PropertiesService.getScriptProperties();
  var to = props.getProperty('PPDB_NOTIFY_EMAIL') || '';
  if (!to) return; // set di Script Properties: PPDB_NOTIFY_EMAIL
  var subject = '[PPDB] Pendaftaran baru: ' + (data.nama_lengkap || id);
  var body = [
    'Pendaftaran PPDB baru masuk.',
    '',
    'No. Registrasi: ' + id,
    'Nama: ' + (data.nama_lengkap || ''),
    'NIK: ' + (data.nik || ''),
    'TTL: ' + [data.tempat_lahir, data.tanggal_lahir].filter(Boolean).join(', '),
    'HP Ortu: ' + (data.no_hp || ''),
    'Ayah: ' + (data.ayah_nama || ''),
    'Ibu: ' + (data.ibu_nama || ''),
    '',
    'Buka panel admin → Data Pendaftaran PPDB untuk meninjau.',
    'Waktu: ' + (data.submitted_at || new Date().toISOString())
  ].join('\n');
  MailApp.sendEmail({ to: to, subject: subject, body: body });
}

function setupToken() {
  // DEPRECATED — gunakan setupSecrets() sekali, lalu edit nilai di Script properties
  setupSecrets();
}

/**
 * Jalankan SEKALI dari editor Apps Script (Run → setupSecrets).
 * Lalu buka Project Settings → Script properties dan ganti nilainya.
 * Jangan commit nilai asli ke GitHub.
 */
function setupSecrets() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('API_TOKEN')) {
    props.setProperty('API_TOKEN', 'ganti-token-panjang-acak');
  }
  if (!props.getProperty('ADMIN_PASSWORD')) {
    props.setProperty('ADMIN_PASSWORD', 'ganti-password-admin');
  }
  // Opsional: props.setProperty('PPDB_NOTIFY_EMAIL', 'email@sekolah.com');
  Logger.log('Script properties siap. WAJIB ganti API_TOKEN & ADMIN_PASSWORD di Project Settings.');
}

function adminLogin_(password) {
  var props = PropertiesService.getScriptProperties();
  var expected = props.getProperty('ADMIN_PASSWORD') || '';
  var apiToken = props.getProperty('API_TOKEN') || '';
  if (!expected) {
    return { ok: false, error: 'ADMIN_PASSWORD belum di-set di Script properties' };
  }
  if (!password || String(password) !== String(expected)) {
    return { ok: false, error: 'Password salah' };
  }
  if (!apiToken) {
    return { ok: false, error: 'API_TOKEN belum di-set di Script properties' };
  }
  // Token hanya diberikan setelah password benar — tidak ada di GitHub / config.js
  return {
    ok: true,
    token: apiToken,
    message: 'Login berhasil',
    ts: new Date().toISOString()
  };
}
