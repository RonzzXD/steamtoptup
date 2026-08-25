const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

// Pola dengan anchor text spesifik — kalau ini kena, langsung dipercaya apa adanya
// karena frasa di depannya sudah cukup jadi penanda ini memang kode Steam Guard.
const ANCHORED_PATTERNS = [
  /Steam Guard code is\s*[:\-]?\s*([A-Z0-9]{5})/i,
  /Steam Guard\s*[:\-]?\s*code\s*[:\-]?\s*([A-Z0-9]{5})/i,
  /your code is\s*[:\-]?\s*([A-Z0-9]{5})/i,
];

// Kata-kata pemicu untuk pola cadangan (dipakai kalau anchor pattern di atas tidak kena)
const TRIGGER_WORDS = /(Steam Guard|verification|verify)/i;
const FALLBACK_WINDOW = 100; // jarak maksimal (karakter) dari kata pemicu untuk mencari kode

// NONAKTIF secara sengaja. Sebelumnya ada logic cadangan yang nyari sembarang string
// 5-karakter di dekat kata "verify"/"Steam Guard", tapi ini terbukti bisa salah tangkap
// (mis. kepotong dari URL/token di email pemulihan akun, yang isinya link — bukan kode).
// Daripada berisiko kasih data yang salah/sensitif ke pembeli, kalau pola tegas di atas
// tidak kena, kita anggap saja "kode belum ada" — lebih aman walau kadang butuh cek manual.
const ENABLE_FUZZY_FALLBACK = false;

// Email dengan subjek/isi seperti ini BUKAN kode login biasa — ini kode untuk memulihkan
// atau mengambil alih akun (ganti email terdaftar, matikan Steam Guard, reset akses, dst).
// Kalau kode jenis ini ikut dibagikan ke pembeli, akun bisa diambil alih permanen.
// Karena itu email seperti ini WAJIB dilewati, apapun isinya.
const DANGEROUS_EMAIL_PATTERNS = [
  /pemulihan akun/i,
  /akun.{0,10}dipulihkan/i,
  /account recovery/i,
  /recover(y|ing)? (your |my )?account/i,
  /reset (your |my )?password/i,
  /ganti (email|kata sandi)/i,
  /change (your )?(email|password)/i,
  /remove steam guard/i,
  /disable steam guard/i,
  /matikan steam guard/i,
  /new email (address )?(has been )?added/i,
  /login approval request/i, // permintaan approval device baru — beda dari kode login biasa
  /password (has been |was )?changed/i,
  /email (has been |was )?changed/i,
  /kata sandi.{0,10}(diubah|berhasil diganti)/i,
];

function isDangerousEmail(subject, text) {
  const combined = `${subject || ''}\n${text || ''}`;
  return DANGEROUS_EMAIL_PATTERNS.some((re) => re.test(combined));
}

function extractCode(text) {
  if (!text) return null;

  // 1) Coba pola-pola dengan anchor text jelas dulu.
  for (const re of ANCHORED_PATTERNS) {
    const m = text.match(re);
    if (m && m[1]) return m[1].toUpperCase();
  }

  // 2) Fallback (nonaktif secara default, lihat ENABLE_FUZZY_FALLBACK di atas).
  //    Kalau suatu saat mau diaktifkan lagi karena banyak kode asli tidak kedeteksi,
  //    aktifkan dengan hati-hati dan uji ulang dengan test-code-extraction.js dulu.
  if (!ENABLE_FUZZY_FALLBACK) return null;

  const triggerMatch = text.match(TRIGGER_WORDS);
  if (!triggerMatch) return null;

  const triggerIndex = triggerMatch.index;
  const windowStart = Math.max(0, triggerIndex - FALLBACK_WINDOW);
  const windowEnd = Math.min(text.length, triggerIndex + triggerMatch[0].length + FALLBACK_WINDOW);
  const windowText = text.slice(windowStart, windowEnd);

  const candidates = windowText.match(/\b[A-Z0-9]{5}\b/gi) || [];
  for (const c of candidates) {
    const candidate = c.toUpperCase();
    if (/[0-9]/.test(candidate) && /[A-Z]/.test(candidate)) return candidate;
  }

  return null;
}

/**
 * Login ke inbox akun via IMAP, cari email terbaru dari Steam yang berisi
 * kode Steam Guard, dan kembalikan kodenya.
 *
 * @param {object} account - baris dari tabel accounts (email, email_password, imap_host, imap_port, imap_secure)
 * @param {object} opts - { sinceMinutes: cari email dalam X menit terakhir saja }
 */
async function fetchSteamGuardCode(account, opts = {}) {
  const sinceMinutes = opts.sinceMinutes || 15;

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: !!account.imap_secure,
    auth: {
      user: account.email,
      pass: account.email_password,
    },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - sinceMinutes * 60 * 1000);

      // Cari email masuk sejak "since". Kita saring lebih lanjut di sisi kita
      // karena nama pengirim Steam bisa "noreply@steampowered.com" atau "account-noreply@steampowered.com".
      const uids = await client.search({ since }, { uid: true });

      if (!uids || uids.length === 0) {
        return { found: false, reason: 'no_recent_email' };
      }

      // Cek dari yang terbaru ke yang lama
      const sortedUids = uids.sort((a, b) => b - a);

      for (const uid of sortedUids.slice(0, 10)) {
        const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
        if (!msg || !msg.source) continue;

        const from = (msg.envelope?.from?.[0]?.address || '').toLowerCase();
        if (!from.includes('steampowered.com') && !from.includes('steamgames.com')) {
          continue;
        }

        const parsed = await simpleParser(msg.source);
        const text = parsed.text || parsed.html || '';
        const subject = parsed.subject || '';

        if (isDangerousEmail(subject, text)) {
          // Sengaja dilewati (bukan cuma "tidak ketemu kode") — ini email sensitif
          // yang tidak boleh diproses jadi kode buat pembeli.
          continue;
        }

        const code = extractCode(text) || extractCode(subject);

        if (code) {
          return { found: true, code, receivedAt: parsed.date };
        }
      }

      return { found: false, reason: 'no_code_in_recent_steam_emails' };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

module.exports = { fetchSteamGuardCode, extractCode, isDangerousEmail };
