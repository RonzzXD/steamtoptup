const express = require('express');
const rateLimitMap = new Map(); // ip -> {count, resetAt}, simple in-memory rate limit
const Token = require('../db/models/Token');
const { fetchSteamGuardCode } = require('../imap');

const router = express.Router();

const MAX_CODE_REQUESTS = parseInt(process.env.MAX_CODE_REQUESTS || '3', 10);

// Rate limit sederhana: max 20 request / 5 menit per IP, untuk cegah brute-force token
function simpleRateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  entry.count += 1;
  rateLimitMap.set(ip, entry);

  if (entry.count > 20) {
    return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });
  }
  next();
}

router.use(simpleRateLimit);

async function getValidToken(tokenStr) {
  const token = await Token.findOne({ token: tokenStr }).populate('accountId');
  if (!token || !token.accountId) return { row: null, error: 'Token tidak valid.' };
  if (token.expiresAt.getTime() < Date.now()) return { row: null, error: 'Token sudah kedaluwarsa.' };
  return { row: token, error: null };
}

// --- Langkah 1: tukar token -> tampilkan username & password ---
router.post('/redeem/credentials', async (req, res) => {
  const { token: tokenStr } = req.body;
  if (!tokenStr) return res.status(400).json({ error: 'Token wajib diisi.' });

  const { row, error } = await getValidToken(tokenStr);
  if (error) return res.status(400).json({ error });

  if (!row.credentialsViewedAt) {
    row.status = 'credentials_viewed';
    row.credentialsViewedAt = new Date();
    await row.save();
  }

  res.json({
    steam_username: row.accountId.steamUsername,
    steam_password: row.accountId.steamPassword,
  });
});

// --- Langkah 2: tukar token yang sama -> ambilkan kode verifikasi dari email ---
router.post('/redeem/code', async (req, res) => {
  const { token: tokenStr } = req.body;
  if (!tokenStr) return res.status(400).json({ error: 'Token wajib diisi.' });

  const { row, error } = await getValidToken(tokenStr);
  if (error) return res.status(400).json({ error });

  if (!row.credentialsViewedAt) {
    return res.status(400).json({ error: 'Ambil username & password terlebih dahulu sebelum minta kode verifikasi.' });
  }

  if (row.codeRequestCount >= MAX_CODE_REQUESTS) {
    return res.status(400).json({
      error: `Token ini sudah mencapai batas maksimal pengambilan kode verifikasi (${MAX_CODE_REQUESTS}x). Hubungi penjual kalau masih butuh bantuan.`,
    });
  }

  try {
    const result = await fetchSteamGuardCode({
      email: row.accountId.email,
      email_password: row.accountId.emailPassword,
      imap_host: row.accountId.imapHost,
      imap_port: row.accountId.imapPort,
      imap_secure: row.accountId.imapSecure,
    }, { sinceMinutes: 15 });

    if (!result.found) {
      return res.status(404).json({
        error: 'Kode verifikasi belum ditemukan. Pastikan Anda sudah mencoba login di Steam agar email kode terkirim, lalu coba lagi.',
      });
    }

    row.status = 'code_viewed';
    row.codeViewedAt = new Date();
    row.codeRequestCount += 1;
    await row.save();

    res.json({ code: result.code, remaining_requests: MAX_CODE_REQUESTS - row.codeRequestCount });
  } catch (err) {
    console.error('IMAP error:', err.message);
    res.status(500).json({ error: 'Gagal mengambil kode dari email. Coba lagi sebentar lagi.' });
  }
});

module.exports = router;
