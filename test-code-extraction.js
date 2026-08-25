// Test cepat untuk fungsi extractCode di imap.js, pakai contoh teks email
// (tidak perlu koneksi IMAP/email asli sama sekali).
//
// Jalankan dengan: node test-code-extraction.js

const { extractCode, isDangerousEmail } = require('./imap');

const samples = [
  {
    name: 'Format umum "Steam Guard code is XXXXX"',
    text: `Hi,
Here is the access code you requested to log into your Steam account.
Your Steam Guard code is R8T4K
This code will only be valid for a short time.`,
    expected: 'R8T4K',
  },
  {
    name: 'Format "your code is"',
    text: `Login attempt detected. your code is: 7GXQ2
If this wasn't you, secure your account immediately.`,
    expected: '7GXQ2',
  },
  {
    name: 'Format campuran spasi/tanda baca "Steam Guard: code J9F3M"',
    text: `Steam Guard: code J9F3M
Enter this to finish logging in.`,
    expected: 'J9F3M',
  },
  {
    name: 'Kode 5 karakter dekat kata "verification" TAPI bukan pola tegas (fallback OFF, harus null)',
    text: `Steam verification required. Enter this code to continue: K3M7Q
Do not share this code with anyone.`,
    expected: null,
  },
  {
    name: 'Email tanpa kode (harus gagal / null)',
    text: `Your Steam account password was changed successfully.`,
    expected: null,
  },
  {
    name: 'Ada kata mirip kode tapi cuma huruf (fallback OFF, harus null)',
    text: `Steam Guard verification: your one-time code below.
GUARD STEAM PLAY9K
Enter it to continue.`,
    expected: null,
  },
  {
    name: 'Link pemulihan akun berisi token acak (fallback OFF, TIDAK BOLEH ke-detect sebagai kode)',
    text: `Pemulihan Akun Steam. Klik link berikut untuk verifikasi:
https://store.steampowered.com/recover?tok=YFW2H9xzQ
Jika ini bukan Anda, abaikan email ini.`,
    expected: null,
  },
];

let allPassed = true;

for (const s of samples) {
  const code = extractCode(s.text);
  const pass = code === s.expected;
  if (!pass) allPassed = false;
  const status = code ? `TERDETEKSI: ${code}` : 'tidak ada kode terdeteksi';
  console.log(`${pass ? '✔' : '✘ GAGAL'} ${s.name}\n  -> ${status} (harusnya: ${s.expected || 'null'})\n`);
}

console.log(allPassed ? 'Semua test extractCode LOLOS.' : 'ADA TEST extractCode YANG GAGAL — cek ANCHORED_PATTERNS di imap.js.');

console.log('\n--- Test filter email berbahaya (pemulihan/recovery akun) ---\n');

const dangerousSamples = [
  {
    name: 'Subjek "Pemulihan Akun Steam" (kasus asli yang ditemukan)',
    subject: 'Pemulihan Akun Steam',
    text: 'Gunakan kode berikut untuk memulihkan akun Steam Anda: YFW2H',
    expectDangerous: true,
  },
  {
    name: 'Subjek bahasa Inggris "Account Recovery"',
    subject: 'Steam Account Recovery',
    text: 'Use this code to recover your account: X7K2P',
    expectDangerous: true,
  },
  {
    name: 'Email ganti password',
    subject: 'Your Steam password has been changed',
    text: 'If you did not request this, contact support immediately.',
    expectDangerous: true,
  },
  {
    name: 'Kode login biasa (HARUS TETAP LOLOS, bukan dianggap bahaya)',
    subject: 'Your Steam account: Login Code',
    text: 'Your Steam Guard code is R8T4K',
    expectDangerous: false,
  },
];

let filterAllPassed = true;
for (const s of dangerousSamples) {
  const result = isDangerousEmail(s.subject, s.text);
  const pass = result === s.expectDangerous;
  if (!pass) filterAllPassed = false;
  console.log(`${pass ? '✔' : '✘ GAGAL'} ${s.name}`);
  console.log(`  -> terdeteksi berbahaya: ${result} (harusnya: ${s.expectDangerous})\n`);
}

console.log(filterAllPassed ? 'Semua test filter LOLOS.' : 'ADA TEST FILTER YANG GAGAL — cek DANGEROUS_EMAIL_PATTERNS di imap.js.');
