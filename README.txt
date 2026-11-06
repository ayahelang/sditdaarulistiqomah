Revisi grup galeri — PRODUKSI
Repo: ayahelang/sditdaarulistiqomah
Domain: https://sditdaarulistiqomah.sch.id

Ganti 3 file di root repo:

  js/admin.js   <- dari folder ini
  js/app.js
  css/style.css

Lalu:
  git add js/admin.js js/app.js css/style.css
  git commit -m "Fix modal edit foto grup + preview admin + layout frontend grup"
  git push

Hard refresh: Ctrl+Shift+R

Isi perbaikan sama dengan versi uji (darulistiqomah):
- Modal Lihat/Edit Foto tampil (edit-modal)
- Preview thumbnail di admin
- Frontend grup full-width (tidak kecil)
