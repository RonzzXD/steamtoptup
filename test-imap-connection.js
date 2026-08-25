// Test langsung koneksi IMAP + pengambilan kode Steam Guard, TANPA lewat web app.
// Berguna buat mastiin kredensial email & koneksi IMAP-nya beres duluan,
// sebelum dites lewat alur token di web.
//
// Cara pakai:
//   1. Isi EMAIL, EMAIL_PASSWORD, IMAP_HOST, IMAP_PORT di bawah (atau lewat env var)
//   2. Jalankan: node test-imap-connection.js
//
// Kalau mau test tanpa filter domain steampowered.com dulu (misal baru mau test apakah
// email TERBARU apapun bisa kebaca), jalankan dengan: TEST_ANY_SENDER=1 node test-imap-connection.js

require('dotenv').config();
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { extractCode, isDangerousEmail } = require('./imap');

const EMAIL = process.env.TEST_EMAIL || 'ISI_EMAIL_ANDA@gmail.com';
const EMAIL_PASSWORD = process.env.TEST_EMAIL_PASSWORD || 'ISI_APP_PASSWORD_ANDA';
const IMAP_HOST = process.env.TEST_IMAP_HOST || 'imap.gmail.com';
const IMAP_PORT = parseInt(process.env.TEST_IMAP_PORT || '993', 10);
const TEST_ANY_SENDER = process.env.TEST_ANY_SENDER === '1';
const SINCE_MINUTES = parseInt(process.env.TEST_SINCE_MINUTES || '60', 10);

async function main() {
  if (EMAIL.includes('ISI_EMAIL') || EMAIL_PASSWORD.includes('ISI_APP')) {
    console.log('Isi dulu EMAIL & EMAIL_PASSWORD di bagian atas file ini (atau lewat env var TEST_EMAIL / TEST_EMAIL_PASSWORD).');
    process.exit(1);
  }

  console.log(`Menghubungkan ke ${IMAP_HOST}:${IMAP_PORT} sebagai ${EMAIL} ...`);

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: EMAIL, pass: EMAIL_PASSWORD },
    logger: false,
  });

  try {
    await client.connect();
    console.log('✔ Login IMAP berhasil.\n');
  } catch (err) {
    console.log('✘ Login IMAP GAGAL.');
    console.log('  Pesan error:', err.message);
    console.log('\n  Cek lagi:');
    console.log('  - Pastikan pakai App Password, bukan password login biasa.');
    console.log('  - Pastikan tidak ada spasi ikut ke-copy di App Password-nya.');
    console.log('  - Pastikan IMAP_HOST & IMAP_PORT benar untuk provider email ini.');
    console.log('  - Untuk Gmail: pastikan 2-Step Verification sudah aktif dulu sebelum bikin App Password.');
    process.exit(1);
  }

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - SINCE_MINUTES * 60 * 1000);
      const uids = await client.search({ since }, { uid: true });

      if (!uids || uids.length === 0) {
        console.log(`Tidak ada email masuk dalam ${SINCE_MINUTES} menit terakhir. Coba kirim email test ke inbox ini dulu, atau perbesar TEST_SINCE_MINUTES.`);
        return;
      }

      console.log(`Ditemukan ${uids.length} email dalam ${SINCE_MINUTES} menit terakhir. Memeriksa dari yang terbaru...\n`);

      const sorted = uids.sort((a, b) => b - a);
      let anyCodeFound = false;

      for (const uid of sorted.slice(0, 10)) {
        const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
        if (!msg || !msg.source) continue;

        const from = msg.envelope?.from?.[0]?.address || '(tidak diketahui)';
        const subject = msg.envelope?.subject || '(tanpa subjek)';
        const isFromSteam = from.toLowerCase().includes('steampowered.com') || from.toLowerCase().includes('steamgames.com');

        if (!TEST_ANY_SENDER && !isFromSteam) {
          console.log(`- [dilewati, bukan dari Steam] dari: ${from} | subjek: ${subject}`);
          continue;
        }

        const parsed = await simpleParser(msg.source);
        const text = parsed.text || parsed.html || '';
        const subject2 = parsed.subject || '';

        if (isDangerousEmail(subject2, text)) {
          console.log(`- [DILEWATI SENGAJA, email sensitif/pemulihan akun] dari: ${from} | subjek: ${subject}`);
          console.log('  (kode di email ini TIDAK diambil, demi keamanan akun)\n');
          continue;
        }

        const code = extractCode(text) || extractCode(subject2);

        if (code) {
          console.log(`✔ dari: ${from} | subjek: ${subject}`);
          console.log(`  KODE TERDETEKSI: ${code}\n`);
          anyCodeFound = true;
        } else {
          console.log(`- dari: ${from} | subjek: ${subject}`);
          console.log('  (tidak ada kode terdeteksi di email ini)\n');
        }
      }

      if (!anyCodeFound) {
        console.log('Belum ada kode yang berhasil terdeteksi.');
        if (!TEST_ANY_SENDER) {
          console.log('Coba jalankan lagi dengan TEST_ANY_SENDER=1 untuk lihat semua email terbaru (bukan cuma dari Steam), buat mastiin email test-nya benar2 masuk & kebaca.');
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Terjadi error tak terduga:', err);
  process.exit(1);
});
