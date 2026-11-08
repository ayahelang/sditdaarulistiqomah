Grup Video dari folder Google Drive
===================================

1. Di Apps Script: paste Code.gs terbaru + pastikan appsscript.json
   (scope drive.readonly). Deploy ulang Web App → New version.
2. Folder Drive harus bisa dibaca akun yang menjalankan script
   (share ke email tersebut, atau "Anyone with the link").
3. Admin → Video → isi Nama grup + URL folder Drive
   → "Deteksi dari Google Drive" (batch 20 file, loop sampai selesai)
   → "+ Tambah / Generate Grup Video" → Simpan ke Google Sheets.

Playback: embed https://drive.google.com/file/d/ID/preview
