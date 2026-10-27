# Romi Salon

Website salon berbahasa Indonesia untuk melihat layanan, membuat reservasi, mengelola membership, dan menjalankan operasional admin. Seluruh tanggal dan waktu menggunakan WIB (Asia/Jakarta).

## Media beranda

Tempatkan video salon di `public/videos/salon.mp4` dan gambar poster di `public/images/hero-poster.jpg`. Hero memakai poster sebagai fallback, dan gambar statis ditampilkan saat pengunjung memilih reduced motion. Jika video belum tersedia, halaman tetap menampilkan poster dan overlay berwarna. Ganti kedua berkas dengan materi milik salon sebelum publikasi.

## Akun demo

- Admin: `admin@romisalon.id` / `RomiAdmin2026!`
- Member: `member@romisalon.id` / `RomiMember2026!`

API menyiapkan akun dan data demo saat layanan dimulai. Jangan gunakan kata sandi demo untuk akun sungguhan.

## Pembayaran

`MOCK_PAYMENT` mengatur pembayaran simulasi; jika variabel ini tidak diatur, mode simulasi aktif. Simulasi hanya menandai transaksi berhasil melalui endpoint server dan aman untuk mencoba alur booking/poin. Koneksi Midtrans Snap live belum diaktifkan. Endpoint notifikasi Midtrans yang memeriksa signature tersedia untuk konfigurasi lanjutan menggunakan `MIDTRANS_SERVER_KEY`; jangan menonaktifkan simulasi sebelum checkout live siap.

## Basis data

Skema Romi Salon berada di `lib/db/src/schema/salon.ts` dan memakai PostgreSQL/Drizzle dari workspace ini. Setelah mengubah skema, jalankan `pnpm --filter @workspace/db run push`. Server membutuhkan `DATABASE_URL` dan `SESSION_SECRET`; keduanya diatur melalui konfigurasi rahasia workspace.

## Pemeriksaan

- `pnpm run typecheck`
- `pnpm --filter @workspace/api-server run typecheck`
- `pnpm --filter @workspace/romi-salon run typecheck`
