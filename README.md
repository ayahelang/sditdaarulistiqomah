# SDIT Daarul Istiqomah — Website

Website resmi **SDIT Daarul Istiqomah** (Tajurhalang, Bogor)  
Domain: https://darulistiqomah.silverhawk.web.id

## Stack
- HTML + CSS + JavaScript (vanilla)
- Konten data-driven: `data/site.json`
- Siap GitHub Pages (folder root = publish)
- Admin demo: `admin/` (localStorage + export JSON)

## Deploy GitHub Pages
1. Buat repo (contoh: `darulistiqomah`)
2. Upload seluruh isi folder ini ke branch `main`
3. Settings → Pages → Source: Deploy from branch `main` / root
4. Custom domain: `darulistiqomah.silverhawk.web.id` (file `CNAME` sudah ada)
5. Di DNS silverhawk.web.id, arahkan CNAME ke `ayahelang.github.io` (atau username GitHub Anda)

## Admin & Database (saran)
- **Sekarang:** edit `data/site.json` atau pakai `admin/` → Export JSON → commit ke repo
- **Produksi (disarankan Supabase):**
  - Auth admin (email)
  - Tabel: carousel, articles, gallery, videos, activities, school_settings
  - Storage untuk upload gambar
  - Website publik fetch dari Supabase REST / generate JSON statis via CI

Firebase cocok untuk prototipe cepat; Supabase lebih nyaman untuk SQL, RLS, dan laporan.

## Powered by
[silverhawk.web.id](https://silverhawk.web.id)


## Admin & Media (Instagram / Facebook)

1. Buka `/admin/`
2. Paste link IG/FB/YouTube → **Deteksi** → **Tambahkan**
3. **Simpan ke Browser** untuk preview lokal
4. Setup Google Sheets: ikuti `apps-script/SETUP.md`
5. Isi `js/config.js` (`sheetsApiUrl`, `apiToken`, `useSheets: true`)
6. **Sinkron ke Google Sheets** / **Ambil dari Sheets**

Multi-guru: share spreadsheet (Editor) atau pakai token yang sama di panel admin.

## Deploy

Upload seluruh folder ke hosting statis (GitHub Pages, Netlify, atau VPS).
Pastikan path `images/`, `data/`, `js/`, `css/`, `admin/` ikut ter-upload.
