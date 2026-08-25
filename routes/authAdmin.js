const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../db/models/Admin');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, key } = req.body;
  if (!username || !key) {
    return res.status(400).json({ error: 'Username dan key wajib diisi.' });
  }

  const admin = await Admin.findOne({ username: username.trim() });
  if (!admin) {
    return res.status(401).json({ error: 'Username atau key salah.' });
  }

  const ok = await bcrypt.compare(key, admin.keyHash);
  if (!ok) {
    return res.status(401).json({ error: 'Username atau key salah.' });
  }

  const token = jwt.sign(
    { sub: admin._id.toString(), username: admin.username },
    process.env.JWT_SECRET,
    { expiresIn: '12h' },
  );

  res.json({ token, username: admin.username });
});

// Ganti key admin (butuh sudah login pakai key lama)
router.post('/change-key', async (req, res) => {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const { newKey } = req.body;

  if (!token) return res.status(401).json({ error: 'Belum login.' });
  if (!newKey || newKey.length < 6) return res.status(400).json({ error: 'Key baru minimal 6 karakter.' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Sesi tidak valid, silakan login lagi.' });
  }

  const admin = await Admin.findById(payload.sub);
  if (!admin) return res.status(404).json({ error: 'Admin tidak ditemukan.' });

  admin.keyHash = await bcrypt.hash(newKey, 10);
  await admin.save();

  res.json({ ok: true });
});

module.exports = router;
