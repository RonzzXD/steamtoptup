# Toko Topup / Sewa Akun Steam — dengan Payment Gateway Midtrans

Web app lengkap untuk jasa topup/sewa akun Steam:

1. **Toko** (`/store.html`) — pelanggan pilih produk, checkout, bayar via **QRIS** atau
   **Link Pembayaran** (Midtrans). Setelah pembayaran sukses, token redeem otomatis dibuat.
2. **Redeem** (`/`) — pelanggan masukkan token → muncul username & password → masukkan
   token lagi → sistem ambil kode Steam Guard terbaru dari email via IMAP.
3. **Admin** (`/admin-login.html` → `/admin.html`) — login pakai **username + key**,
   kelola produk, stok akun, pantau order, generate token manual kalau perlu.

Database pakai **MongoDB**. Password admin (**key**) disimpan ter-hash (bcrypt), bukan
plain-text. Login admin memakai sesi **JWT** yang kedaluwarsa otomatis dalam 12 jam.

## ⚠️ Batasan pengujian oleh saya (baca ini dulu)

Saya sudah menguji:
- Semua file lolos cek sintaks & bisa di-`require()` tanpa error (`node --check`, load semua model/route)
- Logic verifikasi signature webhook Midtrans (`test-midtrans-signature.js`) — lolos
- Logic hash key admin & sesi JWT (`test-admin-auth.js`) — lolos
- Logic pembaca kode Steam Guard dari email (`test-code-extraction.js`) — lolos

**Yang BELUM bisa saya uji** (karena sandbox saya tidak bisa konek ke MongoDB Atlas atau
API Midtrans yang sebenarnya): koneksi database sungguhan, pembuatan transaksi QRIS/Payment
Link yang sebenarnya, dan penerimaan webhook dari Midtrans. Ini perlu dites sendiri pakai
kredensial MongoDB & Midtrans (sandbox) milik Anda — ikuti panduan di bawah langkah demi
langkah, dan kabari kalau ada error supaya bisa saya bantu perbaiki.

## Instalasi

```bash
cd steam-topup
npm install
cp .env.example .env
```

Lalu isi `.env` — penjelasan tiap variabel ada di dalam file `.env.example` itu sendiri,
tapi ringkasannya:

### 1. MongoDB

Paling gampang pakai **MongoDB Atlas** (gratis, tidak perlu install apa pun):
1. Daftar di https://www.mongodb.com/cloud/atlas/register
2. Buat cluster gratis (M0)
3. Buat database user (username + password)
4. Di "Network Access", izinkan IP Anda (atau `0.0.0.0/0` untuk testing, tapi persempit
   lagi nanti untuk produksi)
5. Klik "Connect" → "Drivers" → salin connection string-nya, isi ke `MONGODB_URI` di `.env`

Atau kalau mau lokal, install MongoDB Community Server dari mongodb.com/try/download/community,
lalu `MONGODB_URI=mongodb://127.0.0.1:27017/steam-topup`.

### 2. Login Admin

Isi `ADMIN_USERNAME` dan `ADMIN_KEY` di `.env` — ini dipakai **hanya sekali** untuk
membuat akun admin pertama secara otomatis saat server pertama kali jalan. Isi juga
`JWT_SECRET` dengan string acak panjang (buat gampang: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

Setelah admin pertama dibuat, kalau mau ganti key, gunakan tombol **"Ganti Key"** di
halaman admin — bukan edit `.env` lagi (edit `.env` setelah admin ada tidak akan berpengaruh).

### 3. Midtrans (payment gateway)

1. Daftar akun di https://dashboard.midtrans.com/register
2. Untuk mulai testing, pakai mode **Sandbox** dulu (ada toggle Sandbox/Production di dashboard)
3. Buka **Settings → Access Keys**, salin **Server Key** dan **Client Key**, isi ke
   `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` di `.env`
4. **Daftarkan webhook**: di **Settings → Configuration**, isi "Payment Notification URL"
   dengan `https://domain-anda.com/api/payment/notification`. Kalau masih testing di
   `localhost`, Midtrans tidak bisa menjangkau komputer Anda langsung — pakai
   [ngrok](https://ngrok.com) dulu: jalankan `ngrok http 3000`, lalu pakai URL `https://xxxx.ngrok-free.app/api/payment/notification` sebagai notification URL.
5. QRIS di akun sandbox biasanya otomatis aktif. Kalau di produksi QRIS belum aktif,
   aktifkan dulu di dashboard Midtrans (Settings → Payment Methods).

### 4. Jalankan

```bash
npm start
```

- Toko (pelanggan)  : `http://localhost:3000/store.html`
- Redeem token      : `http://localhost:3000/`
- Login admin       : `http://localhost:3000/admin-login.html`

## Testing tanpa kredensial asli (offline)

```bash
node test-midtrans-signature.js   # verifikasi signature webhook Midtrans
node test-admin-auth.js           # hash key admin + sesi JWT
node test-code-extraction.js      # pembaca kode Steam Guard dari email
node test-imap-connection.js      # koneksi IMAP asli (butuh isi email/app password dulu)
```

## Alur pemakaian

1. **Admin** login → tambah **Produk** (nama, deskripsi, harga) → tambah **Stok Akun**
   untuk produk itu (kredensial Steam + email untuk ambil kode)
2. **Pelanggan** buka `/store.html`, pilih produk, checkout, bayar via QRIS atau link
3. Midtrans kirim webhook ke `/api/payment/notification` saat pembayaran sukses
4. Sistem otomatis cari 1 akun `available` untuk produk itu, buat **token**, tandai
   order `fulfilled` — pelanggan langsung lihat token-nya di halaman toko (auto-update,
   polling tiap 4 detik)
5. Kalau stok akun kosong saat itu, order berstatus `paid_no_stock` — admin tambah stok
   lalu klik **"Fulfill Manual"** di tabel Order untuk assign akun & generate token
6. Pelanggan pakai token itu di halaman `/` — alurnya sama seperti sebelumnya (ambil
   username/password → ambil kode verifikasi dari email)

## Menyiapkan email akun (IMAP)

Kolom "Password Email" di form admin **bukan** password login email biasa, tapi **App
Password**:

- **Gmail**: aktifkan 2-Step Verification di akun email tsb, lalu buat App Password di
  `myaccount.google.com/apppasswords`. IMAP host: `imap.gmail.com`, port `993`.
- **Outlook/Hotmail**: buat App Password di pengaturan keamanan akun. IMAP host:
  `outlook.office365.com`, port `993`.

Password App Password biasanya ditampilkan dengan spasi (mis. `abcd efgh ijkl mnop`) —
hapus semua spasinya sebelum dimasukkan ke form.

Sistem hanya membaca inbox, mencari email terbaru dari domain `steampowered.com` /
`steamgames.com` dalam 15 menit terakhir. Email jenis **pemulihan akun / ganti password /
ganti email** sengaja **dilewati** (tidak diproses jadi kode), demi keamanan — supaya
kode sensitif yang bisa dipakai mengambil alih akun tidak ikut terbagikan ke pembeli.

## Struktur folder

```
steam-topup/
├── server.js
├── db/
│   ├── mongoose.js
│   └── models/
│       ├── Admin.js
│       ├── Product.js
│       ├── Account.js
│       ├── Order.js
│       └── Token.js
├── middleware/
│   └── requireAdminAuth.js      # verifikasi JWT admin
├── services/
│   └── midtrans.js              # QRIS, Payment Link, verifikasi webhook
├── routes/
│   ├── authAdmin.js             # login & ganti key admin
│   ├── admin.js                 # kelola produk/akun/order/token (perlu login)
│   ├── store.js                 # toko publik: list produk, buat order
│   ├── payment.js               # webhook notifikasi Midtrans
│   └── public.js                # redeem token (pelanggan)
├── public/
│   ├── store.html               # halaman toko
│   ├── admin-login.html
│   ├── admin.html
│   ├── index.html               # halaman redeem token
│   └── style.css
├── imap.js                      # baca kode Steam Guard dari email
├── test-code-extraction.js
├── test-imap-connection.js
├── test-midtrans-signature.js
├── test-admin-auth.js
├── package.json
└── .env.example
```

## Catatan keamanan

- Password akun Steam & App Password email disimpan plain-text di MongoDB. Untuk
  pemakaian serius, pertimbangkan enkripsi kolom itu (mis. pakai `crypto` Node dengan
  key terpisah), dan batasi akses ke database (jangan pakai `0.0.0.0/0` di Network
  Access MongoDB Atlas untuk produksi).
- Key admin di-hash pakai bcrypt — tidak pernah disimpan plain-text. Sesi login (JWT)
  kedaluwarsa otomatis 12 jam.
- Webhook Midtrans diverifikasi signature-nya (SHA512) sebelum diproses — notifikasi
  palsu otomatis ditolak.
- Ada rate limit dasar (20 request/5 menit per IP) di endpoint redeem token untuk
  mencegah brute-force.
- Ambil kode verifikasi dibatasi maksimal `MAX_CODE_REQUESTS` kali per token (default 3x).
- Email jenis pemulihan akun/ganti password sengaja dilewati dari pembacaan kode otomatis.
