REVISI — VERSI PRODUKSI (sditdaarulistiqomah.sch.id)
=====================================================
Sumber: versi percobaan (darulistiqomah / silverhawk) yang sudah diuji memuaskan.
Tanggal dasar: 2026-11-07

Domain CNAME: sditdaarulistiqomah.sch.id
robots.txt & sitemap.xml disesuaikan ke domain produksi
  (.sch.id + alias .web.id).

Perubahan utama (dari trial):
1. UI Admin → tab Galeri: section "Grup Galeri Foto (bulk dari folder)"
   - + Tambah Grup Galeri Foto
   - Scan Folder (GitHub API)
   - Judul default dari nama file
   - Deskripsi default = nama grup + judul foto
   - CRUD per-foto via tombol Edit File di setiap grup
2. Grup Video (playlist / multi-link) sudah ada di tab Video.
3. CNAME, robots, sitemap disesuaikan untuk produksi.

Cara pakai bulk foto:
1. Pastikan folder gambar sudah di-push ke repo (mis. images/foto/mabit/)
2. Admin → Galeri → + Tambah Grup Galeri Foto → isi Nama + Path folder
3. Simpan → Scan Folder → edit judul/desc jika perlu → Simpan ke Google Sheets
4. Frontend: card grup muncul; klik untuk membuka daftar foto.

Upload zip ini ke repo sditdaarulistiqomah (overwrite code files; folder images/ tidak ikut karena sama dengan yang sudah ada).

Revisi UI admin (mobile-friendly):
- Thumbnail grup galeri: path di-resolve dengan ../ agar tidak broken di /admin/
- Card list (foto/video): di layar sempit aksi digabung ke menu ⋮ (titik tiga)
- Meta/path panjang disembunyikan di mobile (cukup judul)
- Tab menu & toolbar atas: scroll horizontal 1 baris
- Preview grid grup foto lebih rapat

Catatan:
- File gambar TIDAK disertakan di zip ini (agar ringan).
- Pastikan folder images/ di repo produksi tetap utuh.
