require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');

const { connectDB } = require('./db/mongoose');
const Admin = require('./db/models/Admin');

const authAdminRoutes = require('./routes/authAdmin');
const adminRoutes = require('./routes/admin');
const storeRoutes = require('./routes/store');
const paymentRoutes = require('./routes/payment');
const publicRoutes = require('./routes/public');

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/admin/auth', authAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api', publicRoutes);

app.get('/healthz', (req, res) => res.json({ ok: true }));

// Buat admin pertama otomatis kalau belum ada admin sama sekali di database,
// pakai ADMIN_USERNAME & ADMIN_KEY dari .env. Setelah admin pertama dibuat,
// perubahan ADMIN_USERNAME/ADMIN_KEY di .env TIDAK berpengaruh lagi -- ganti key
// lewat halaman admin (fitur ganti key) kalau perlu.
async function bootstrapAdmin() {
  const count = await Admin.countDocuments();
  if (count > 0) return;

  const username = process.env.ADMIN_USERNAME;
  const key = process.env.ADMIN_KEY;
  if (!username || !key) {
    console.warn('⚠ Belum ada admin di database, dan ADMIN_USERNAME/ADMIN_KEY belum diisi di .env.');
    console.warn('  Tidak akan bisa login ke admin panel sampai ini diisi lalu server di-restart.');
    return;
  }

  const keyHash = await bcrypt.hash(key, 10);
  await Admin.create({ username, keyHash });
  console.log(`✔ Admin pertama dibuat -> username: "${username}" (pakai ADMIN_KEY dari .env untuk login pertama kali)`);
}

async function main() {
  await connectDB();
  await bootstrapAdmin();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Steam topup server jalan di http://localhost:${PORT}`);
    console.log(`Toko (customer) : http://localhost:${PORT}/store.html`);
    console.log(`Redeem token    : http://localhost:${PORT}/`);
    console.log(`Admin login     : http://localhost:${PORT}/admin-login.html`);
  });
}

main().catch((err) => {
  console.error('Gagal start server:', err);
  process.exit(1);
});
