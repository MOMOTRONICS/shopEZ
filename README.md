# ShopEZ

ShopEZ adalah prototipe toko online full-stack sesuai spesifikasi: katalog dan pencarian produk, autentikasi pengguna, keranjang, checkout, riwayat pesanan, serta dashboard admin untuk mengelola produk dan status pesanan.

## Teknologi

- Frontend: React 18 dan Vite
- Backend: Node.js, Express, dan Mongoose
- Database: MongoDB

## Menjalankan secara lokal

1. Pastikan Node.js 16+ dan MongoDB tersedia.
2. Salin `server/.env.example` menjadi `server/.env`, lalu isi `JWT_SECRET` dengan nilai acak yang panjang. Atur `MONGO_URI` sesuai MongoDB lokal atau Atlas.
3. Salin `client/.env.example` menjadi `client/.env` bila URL API bukan `http://localhost:8000/api`.
4. Dari folder proyek, jalankan `npm install`, `npm install --prefix client`, dan `npm install --prefix server`.
5. Jalankan `npm run dev` untuk memulai frontend (`http://localhost:8080`) dan API (`http://localhost:8000`).

Database MongoDB harus aktif sebelum server dijalankan. Atur `ADMIN_EMAIL` dan `ADMIN_PASSWORD` di `server/.env` untuk membuat akun admin awal saat server pertama kali dijalankan. Gunakan kata sandi acak yang panjang dan jangan membagikan file `.env`. Enam belas produk contoh dalam beberapa kategori akan dimasukkan otomatis jika belum ada; produk contoh yang sudah tersimpan atau produk buatan admin tidak akan ditimpa.

### Cara mudah di Windows

Setelah membuat `server/.env` (atau menjalankan wizard Atlas di bawah), klik dua kali `start-shopez.bat` di folder proyek. Skrip akan memasang dependensi yang belum ada dan menyalakan frontend serta API. Biarkan jendela terminal terbuka; tekan `Ctrl+C` untuk menghentikannya. Buka `http://localhost:8080` di browser.

### MongoDB Atlas (cloud)

1. Buat cluster MongoDB Atlas dan database user di [MongoDB Atlas](https://www.mongodb.com/cloud/atlas). Database user ini berbeda dari akun login Atlas.
2. Pada **Network Access**, tambahkan IP publik komputer kamu. Jangan membuka database ke semua alamat IP (`0.0.0.0/0`) untuk aplikasi ini.
3. Pilih **Connect → Drivers → Node.js**, lalu salin connection string template Atlas.
4. Klik dua kali `setup-atlas.bat`. Tempel URI saat diminta. Wizard kemudian meminta username `shopez_app` dan kata sandi database secara terpisah; kolom kata sandi tersembunyi. Karakter khusus di kata sandi akan di-encode otomatis. Jangan kirim kredensial tersebut lewat chat. Skrip membuat `server/.env` berisi URI Atlas dan secret JWT acak. File tersebut tidak masuk Git.
5. Setelah setup berhasil, klik dua kali `start-shopez.bat`, lalu buka `http://localhost:8080`. Pastikan jendela terminal tetap terbuka selagi aplikasi berjalan.

## Fitur utama

- Katalog, kategori, pencarian, stok, dan harga dari database.
- Daftar akun dan masuk dengan kata sandi yang di-hash serta sesi JWT.
- Keranjang tamu tersimpan di browser; keranjang pengguna tersimpan di MongoDB, dipulihkan saat login, dan divalidasi terhadap stok.
- Ulasan produk dan rating pelanggan, satu ulasan yang dapat diperbarui per pengguna untuk tiap produk.
- Kode diskon `FIRSTJOY` (10%, minimum belanja Rp100.000) dan `SHOP15` (15%, minimum belanja Rp250.000). Nilai diskon dihitung dan diverifikasi ulang oleh server saat checkout.
- Rekomendasi produk berdasarkan isi keranjang atau rating produk.
- Checkout tervalidasi dan stok diperbarui saat pesanan dibuat.
- Riwayat pesanan untuk pelanggan dan pengelolaan pesanan untuk admin.
- Halaman dashboard, katalog dan diskon, serta pesanan admin yang terpisah.
- Endpoint pemeriksaan server: `GET /api/health`.

Admin dapat membuat dan mengaktifkan atau menonaktifkan kode diskon dari halaman **Produk toko**. Endpoint API keranjang memerlukan login; validasi kode diskon tersedia di `POST /api/discounts/validate`; ulasan disimpan melalui `POST /api/products/:id/reviews`.
