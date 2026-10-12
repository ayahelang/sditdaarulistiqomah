# Roadmap database — SDIT Daarul Istiqomah

## Fase 1 (sekarang): Google Sheets + Apps Script
- Data media di spreadsheet
- Panel admin web + share Sheet ke guru
- Cache 60 dtk (server) + 5 menit (browser)
- Cukup untuk traffic website sekolah

## Fase 2: Supabase (jika dibutuhkan)
Pindah jika:
- Banyak guru upload bersamaan
- Butuh login email/password per user
- Butuh menyimpan file gambar di cloud
- Sheets terasa lambat meski sudah di-cache

### Outline migrasi Supabase
1. Buat project di https://supabase.com
2. Tabel `media` (kolom sama seperti sheet)
3. Auth → invite guru
4. Ganti `js/config.js` ke Supabase URL + anon key
5. RLS: publik baca `active=true`; editor bisa write

## Fase 3: Firebase
Alternatif Supabase (Auth + Firestore + Storage). Pilih salah satu saja.
