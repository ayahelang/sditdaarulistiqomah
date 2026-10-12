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
