# 🎮 Toko Topup & Jasa Sewa Akun Steam 

Aplikasi web (*Full-Stack*) berbasis Node.js dan MongoDB untuk mempermudah top-up atau sewa akun Steam. Dilengkapi dengan integrasi otomatisasi pembayaran via trakteer dan penarikan kode **Steam Guard** langsung dari email.

---

## ✨ Fitur Utama

1. **Etalase Toko (`/store.html`)**
   * Pelanggan dapat memilih produk dan melakukan checkout langsung.
   * Integrasi **Payment Gateway Midtrans** (QRIS & Payment Link).
   * Status pembayaran diperbarui secara otomatis menggunakan sistem *polling* (tiap 4 detik).
   * Token redeem otomatis dibuat begitu pembayaran dinyatakan sukses.

2. **Sistem Penukaran Token (`/`)**
   * Pelanggan memasukkan token redeem untuk memunculkan kredensial (*username* & *password*).
   * **Otomatisasi Steam Guard:** Sistem membaca kotak masuk email via IMAP secara berkala untuk mengambil kode verifikasi terbaru dari Steam.
   * Keamanan ekstra: Email yang berisi tautan/kode sensitif seperti pemulihan akun atau penggantian *password* akan dilewati demi mencegah pengambilalihan akun.

3. **Panel Admin (`/admin.html`)**
   * Login aman menggunakan sesi **JWT (JSON Web Token)** yang kedaluwarsa otomatis dalam 12 jam.
   * Kelola produk (tambah, edit, hapus).
   * Manajemen stok akun Steam.
   * Pantau riwayat transaksi/order dan pembuatan token manual (*Fulfill Manual*).
---

## 🛠️ Persyaratan Sistem

Sebelum memulai, pastikan perangkat Anda sudah terinstal:
* [Node.js](https://nodejs.org) (Versi LTS direkomendasikan)
* [MongoDB](https://mongodb.com) (Lokal) atau akun [MongoDB Atlas](https://mongodb.com) (Cloud)

---
## 🚀 Panduan Instalasi & Penggunaan

### 1. Kloning dan Instal Dependensi
Buka terminal/command prompt, masuk ke direktori proyek, lalu jalankan perintah berikut:
```bash
cd steam-topup
npm install
```

### 2. Konfigurasi Environment Variables
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Buka file `.env` dan lengkapi variabel berikut sesuai dengan kebutuhan Anda:

*   **Database (MongoDB):**
    *   *Opsi Cloud (Atlas):* Isi `MONGODB_URI` dengan *connection string* dari cluster gratis Anda.
    *   *Opsi Lokal:* Gunakan `MONGODB_URI=mongodb://127.0.0.1:27017/steam-topup`.
*   **Kredensial Admin:**
    *   Tentukan `ADMIN_USERNAME` dan `ADMIN_KEY` pertama Anda (Hanya dibaca sekali saat inisialisasi awal server).
    *   Generate string acak panjang untuk `JWT_SECRET` dengan menjalankan perintah ini di terminal:
        ```bash
        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
        ```

### 3. Konfigurasi Email Akun Steam (IMAP)
Saat memasukkan "Password Email" di panel admin, **jangan gunakan password login biasa**. Anda wajib menggunakan **App Password**:
*   **Gmail:** Aktifkan Verifikasi 2 Langkah, lalu buat App Password di `://google.com`. (Host: `://gmail.com`, Port: `993`).
*   **Outlook:** Buat App Password di menu keamanan akun Microsoft. (Host: `://office365.com`, Port: `993`).
*   *Catatan:* Hapus semua spasi pada App Password sebelum menyimpannya ke sistem.

### 4. Menjalankan Aplikasi
Setelah semua konfigurasi selesai, jalankan server:
```bash
npm start
```
Aplikasi Anda kini dapat diakses melalui peramban pada tautan berikut:
*   **Halaman Toko (Pelanggan):** `http://localhost:3000/store.html`
*   **Halaman Redeem Token:** `http://localhost:3000/`
*   **Halaman Login Admin:** `http://localhost:3000/admin-login.html`

---
```
---
## 🔒 Catatan Keamanan

1. **Enkripsi Data Sensitf:** Pada versi dasar ini, password akun Steam dan App Password email disimpan dalam bentuk *plain-text* di database. Untuk kebutuhan produksi skala besar, sangat disarankan menambahkan enkripsi dua arah (misal menggunakan modul `crypto` bawaan Node.js).
2. **Akses Jaringan:** Batasi akses IP pada kluster MongoDB Anda. Jangan gunakan `0.0.0.0/0` ketika aplikasi sudah dirilis secara publik.
3. **Sistem Keamanan Token:** Fitur ambil kode dibatasi maksimal 3 kali permintaan per token dan dilengkapi dengan *rate limiter* (20 request/5 menit per IP) untuk menghindari serangan brute-force.
