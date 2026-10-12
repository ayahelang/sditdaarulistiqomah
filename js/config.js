/**
 * Konfigurasi publik SDIT Daarul Istiqomah
 * -----------------------------------------
 * File ini ikut ter-download di browser — JANGAN taruh rahasia di sini.
 *
 * Rahasia (API_TOKEN, ADMIN_PASSWORD, PPDB_NOTIFY_EMAIL) disimpan di
 * Google Apps Script → Project Settings → Script properties.
 * Lihat apps-script/SETUP.md
 */
window.SDIT_CONFIG = {
  // URL Web App dari Google Apps Script (boleh publik)
  sheetsApiUrl: 'https://script.google.com/macros/s/AKfycbxsEoAUFqVq2Pa11lYASnBFuUK1Q70Zbz-Wi_eXlDnGhHPzkaNbQ0JdLnRpsZnY-mHr6g/exec',
  // true = frontend & admin pakai Google Sheets sebagai sumber data
  useSheets: true,
  // Cache singkat di browser (ms)
  siteCacheTtl: 60 * 1000
};
