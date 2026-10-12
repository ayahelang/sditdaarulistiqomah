/**
 * Konfigurasi SDIT Daarul Istiqomah
 * ---------------------------------
 * WAJIB isi sheetsApiUrl + apiToken setelah deploy Apps Script.
 * Lihat apps-script/SETUP.md
 *
 * Mode: SEMUA data website (carousel, berita, galeri, media, video, profil)
 * dibaca & disimpan lewat Google Sheets — bukan localStorage.
 */
window.SDIT_CONFIG = {
  // URL Web App dari Google Apps Script (kosongkan jika belum setup)
  sheetsApiUrl: 'https://script.google.com/macros/s/AKfycbxsEoAUFqVq2Pa11lYASnBFuUK1Q70Zbz-Wi_eXlDnGhHPzkaNbQ0JdLnRpsZnY-mHr6g/exec',
  // Token rahasia (sama dengan Script Property API_TOKEN)
  apiToken: 'sdit-di-rahasia-2026',
  // true = frontend & admin pakai Google Sheets sebagai sumber media
  useSheets: true,
  // Cache singkat di browser (ms) — tetap refetch dari Sheets setelah TTL
  siteCacheTtl: 60 * 1000
};
