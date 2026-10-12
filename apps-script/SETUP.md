# Setup Google Sheets — SDIT Daarul Istiqomah

> **Arsitektur (wajib dibaca)**  
> Semua data website (profil, carousel, berita, galeri, video, media) **dibaca dan disimpan ke Google Sheets**.  
> `data/site.json` hanya fallback jika Sheets belum dikonfigurasi.  
> Tombol **Simpan ke Google Sheets** di panel admin menulis snapshot penuh ke sheet `site`.

---


Panduan lengkap agar admin bisa menambah foto/video dari link Instagram/Facebook, data tersimpan di Google Sheet, dan website membacanya dengan cache (tidak lambat).

---

## Langkah 1 — Buat Google Spreadsheet

1. Buka [Google Sheets](https://sheets.google.com) → **Blank spreadsheet**
2. Rename judul: `SDIT Daarul Istiqomah CMS`
3. Buat / rename sheet **`site`** dengan header baris 1:
```
key | json | updated_at
```
(kosongkan dulu — panel admin akan mengisi saat **Simpan ke Google Sheets** pertama kali)

4. Buat sheet **`media`** (mirror otomatis) dengan header:
```
id | url | type | source | shortcode | title | description | category | thumb | embedUrl | active | date | created_by
```

5. (Opsional) Buat sheet kedua **`admins`** dengan header:
```
email | nama | role
```
Contoh baris: `guru1@gmail.com | Ust. Ahmad | editor`

6. **Share spreadsheet** ke email guru/admin lain (role **Editor**) agar mereka bisa menambah data langsung di Sheet, atau lewat panel admin web.

---

## Langkah 2 — Pasang Apps Script

1. Di spreadsheet: **Extensions → Apps Script**
2. Hapus kode default di `Code.gs`
3. Copy seluruh isi file `apps-script/Code.gs` dari repo website ini → tempel
4. Simpan (Ctrl+S), nama project: `SDIT DI API`

### Set token rahasia
1. Di Apps Script: **Project Settings** (ikon roda gigi) → **Script properties** → **Add script property**
2. Property: `API_TOKEN`  
   Value: buat string rahasia, contoh `sdit-di-rahasia-2026`
3. Simpan

Atau jalankan fungsi `setupToken()` sekali, lalu edit nilainya di Script properties.

---

## Langkah 3 — Deploy sebagai Web App

1. **Deploy → New deployment**
2. Type: **Web app**
3. Description: `v1`
4. **Execute as:** Me
5. **Who has access:** Anyone
6. Deploy → Authorize permissions (pilih akun Google → Advanced → Go to project → Allow)
7. **Salin Web App URL**  
   Bentuknya: `https://script.google.com/macros/s/XXXXXXXX/exec`

---

## Langkah 4 — Hubungkan ke website

Edit file `js/config.js` di website:

```js
window.SDIT_CONFIG = {
  sheetsApiUrl: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  apiToken: 'sdit-di-rahasia-2026',
  useSheets: true,   // WAJIB true — sumber & tujuan data = Google Sheets
  siteCacheTtl: 60000
};
```

Upload ulang file `js/config.js` ke hosting.

---

## Langkah 5 — Uji

Buka di browser (ganti URL):

```
https://script.google.com/macros/s/XXXXXXXX/exec?action=ping
```

Harus muncul: `{"ok":true,"service":"sdit-di",...}`

List media:
```
https://script.google.com/macros/s/XXXXXXXX/exec?action=list
```

---

## Cara pakai panel admin

1. Buka `https://domain-anda/admin/`
2. Section **Media dari Instagram / Facebook**
3. Paste link reel/post → klik **Deteksi**
4. Isi judul/deskripsi jika perlu (boleh dikosongkan; default otomatis)
5. **Tambah ke Galeri**
6. **Simpan ke Browser** (lokal) dan/atau **Sinkron ke Google Sheets**
7. Buka halaman utama → cek section Galeri & Video

### Multi-admin / guru
- **Cara termudah:** Share spreadsheet ke email guru (Editor). Mereka bisa isi baris baru di sheet `media`.
- **Lewat panel admin:** guru buka `/admin/`, pastikan `config.js` sudah terisi URL + token yang sama.

---

## Performa (agar tidak lambat)

- Apps Script menyimpan **cache 60 detik** untuk `action=list`
- Website menyimpan hasil fetch di **localStorage** (TTL 5 menit)
- Pengunjung jarang memukul Sheets secara langsung berulang-ulang
- Jika traffic besar / terasa lambat: naikkan ke **Supabase** (lihat `ROADMAP.md`)

---

## API ringkas

| Action | Method | Parameter |
|--------|--------|-----------|
| `ping` | GET | — |
| `list` | GET | — |
| `add` | POST | `{ token, item: {...} }` |
| `update` | POST | `{ token, item: { id, ... } }` |
| `delete` | POST | `{ token, id }` |
| `publish` | GET/POST | `token` → snapshot JSON aktif |

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| CORS / blocked | Deploy ulang, pastikan "Anyone" |
| Unauthorized | Samakan `apiToken` di config.js dengan Script property |
| Data lama | Tunggu cache 60 dtk, atau hard-refresh admin |
| Embed IG blank | Pastikan post **publik**; beberapa akun private tidak bisa di-embed |

## Cara mendapatkan API Token (langkah detail)

Token ini **bukan** dari Instagram atau Google OAuth. Anda yang membuat sendiri (password rahasia).

### Buat token
1. Buat string acak, contoh: `sdit-di-rahasia-2026` atau generate di terminal:
   ```
   openssl rand -hex 16
   ```
2. Ingat/simpan string itu.

### Simpan di Google Apps Script
1. Buka project Apps Script (dari Spreadsheet → Extensions → Apps Script)
2. Klik ikon **Project Settings** (roda gigi kiri)
3. Scroll ke **Script properties**
4. Klik **Add script property**
5. Property: `API_TOKEN`
6. Value: tempel string rahasia Anda
7. Save

### Simpan di website
Edit file `js/config.js`:

```js
window.SDIT_CONFIG = {
  sheetsApiUrl: 'https://script.google.com/macros/s/XXXX/exec',
  apiToken: 'sdit-di-rahasia-2026',  // sama persis dengan Script property
  useSheets: true,
  mediaCacheTtl: 300000
};
```

### Uji
- List (tanpa token): `...?action=list`
- Write (butuh token): panel admin → Sinkron ke Google Sheets

Jika muncul `Unauthorized`, token di config.js dan Script properties belum sama.


---

## Sheet PPDB (pendaftaran online)

Setelah update `Code.gs` yang mendukung `submitPpdb`, buat sheet bernama **`ppdb`** (opsional — header otomatis saat submit pertama).

Kolom mengikuti field Dapodik-ready:
```
id | submitted_at | tahun_ajaran | jenjang | sekolah | npsn | status |
nama_lengkap | nik | nisn | no_akta_lahir | tempat_lahir | tanggal_lahir |
jenis_kelamin | agama | kewarganegaraan | anak_ke | jumlah_saudara | kebutuhan_khusus |
alamat_jalan | rt | rw | desa_kelurahan | kecamatan | kabupaten_kota | provinsi | kode_pos |
jarak_km | transportasi | asal_sekolah | asal_sekolah_alamat | tahun_lulus_asal |
ayah_nama | ayah_nik | ayah_pendidikan | ayah_pekerjaan | ayah_penghasilan |
ibu_nama | ibu_nik | ibu_pendidikan | ibu_pekerjaan | ibu_penghasilan |
wali_nama | wali_hubungan | no_hp | email_ortu |
minat_program | tinggi_badan | berat_badan | catatan | persetujuan | source_url | user_agent
```

**Redeploy** Web App (New version) agar endpoint `submitPpdb` aktif.

Export → Download CSV dari sheet `ppdb` untuk diimpor ke aplikasi PPDB sekolah atau mapping ke Dapodik.


---

## Notifikasi PPDB (lonceng + email)

Setelah redeploy Apps Script:

1. **Lonceng di website publik** — otomatis menampilkan jumlah formulir baru (`getPpdbNotif`). Klik → password admin → panel Data PPDB. Saat admin membuka list, notifikasi di-reset (`markPpdbRead`).

2. **Email opsional** — di Apps Script → Project Settings → Script properties, tambah:
   - `PPDB_NOTIFY_EMAIL` = email admin (contoh: `darulistiqomahsdit@gmail.com`)
   
   Setiap submit formulir akan mengirim email ringkasan (via `MailApp`).

**Catatan WhatsApp otomatis:** pengiriman WA ke admin tanpa interaksi pengguna membutuhkan WhatsApp Business API / gateway berbayar. Lonceng + email adalah alternatif yang stabil di stack ini.

---

## Keamanan: Script properties (wajib)

Rahasia **tidak** disimpan di `js/config.js` / GitHub. Semua di **Apps Script → Project Settings → Script properties**:

| Property | Fungsi |
|----------|--------|
| `API_TOKEN` | Token untuk aksi admin (saveSite, list/update/delete PPDB, mark read) |
| `ADMIN_PASSWORD` | Password login panel admin + lonceng notifikasi |
| `PPDB_NOTIFY_EMAIL` | (Opsional) Email penerima notifikasi formulir baru |

### Setup awal
1. Di editor Apps Script, jalankan fungsi `setupSecrets` sekali (Run).
2. Buka **Project Settings → Script properties**, **ganti** nilai default:
   - `API_TOKEN` → string acak panjang (contoh dari password manager)
   - `ADMIN_PASSWORD` → password admin yang kuat
   - `PPDB_NOTIFY_EMAIL` → email sekolah (opsional)
3. **Deploy → New version** Web App.

Login admin memanggil `action=adminLogin` → server cek password → baru mengembalikan `API_TOKEN` ke session browser. Token tidak ada di repo.

### Keamanan Google Sheet (penting)

**Jangan** set share spreadsheet ke *Anyone with the link* sebagai **Editor**.

Setup yang benar:
1. Spreadsheet **Restricted** (hanya orang spesifik).
2. Owner = akun yang mendeploy Apps Script.
3. Deploy Web App: **Execute as: Me** → script menulis ke Sheet sebagai owner, **tanpa** perlu share publik.
4. Guru yang perlu buka Sheet langsung: **Share → email mereka → Editor** (bukan "anyone").
5. Website publik hanya memanggil URL Web App, **bukan** URL spreadsheet.

Siapa pun dengan link *Editor* bisa mengubah/menghapus semua data CMS & PPDB.

### config.js yang boleh di GitHub
Hanya: `sheetsApiUrl`, `useSheets`, `siteCacheTtl`.
