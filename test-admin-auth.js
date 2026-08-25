// Test offline untuk logic auth admin (hash key + JWT), TANPA perlu MongoDB atau
// server jalan sama sekali.
//
// Jalankan dengan: node test-admin-auth.js

process.env.JWT_SECRET = 'test-jwt-secret-untuk-testing-saja';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function main() {
  let allPassed = true;

  // --- Test 1: hash & compare key yang benar ---
  const originalKey = 'rahasia-toko-saya-123';
  const hash = await bcrypt.hash(originalKey, 10);
  const compareCorrect = await bcrypt.compare(originalKey, hash);
  const pass1 = compareCorrect === true;
  if (!pass1) allPassed = false;
  console.log(`${pass1 ? '✔' : '✘ GAGAL'} Key yang benar cocok dengan hash-nya`);

  // --- Test 2: key yang salah harus ditolak ---
  const compareWrong = await bcrypt.compare('key-yang-salah', hash);
  const pass2 = compareWrong === false;
  if (!pass2) allPassed = false;
  console.log(`${pass2 ? '✔' : '✘ GAGAL'} Key yang salah ditolak (tidak cocok dengan hash)`);

  // --- Test 3: hash tidak pernah sama dengan key asli (memang tidak boleh plain-text) ---
  const pass3 = hash !== originalKey;
  if (!pass3) allPassed = false;
  console.log(`${pass3 ? '✔' : '✘ GAGAL'} Hash yang disimpan bukan plain-text dari key asli`);

  // --- Test 4: JWT sign & verify berhasil untuk token valid ---
  const token = jwt.sign({ sub: 'admin123', username: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    decoded = null;
  }
  const pass4 = decoded && decoded.username === 'admin';
  if (!pass4) allPassed = false;
  console.log(`${pass4 ? '✔' : '✘ GAGAL'} Token JWT valid berhasil di-decode dengan benar`);

  // --- Test 5: JWT dengan secret yang salah harus ditolak (mensimulasikan token dipalsukan) ---
  let forgedOk = true;
  try {
    jwt.verify(token, 'secret-yang-salah');
  } catch (e) {
    forgedOk = false;
  }
  const pass5 = forgedOk === false;
  if (!pass5) allPassed = false;
  console.log(`${pass5 ? '✔' : '✘ GAGAL'} Token dengan secret salah/dipalsukan ditolak`);

  // --- Test 6: JWT yang sudah kedaluwarsa harus ditolak ---
  const expiredToken = jwt.sign({ sub: 'admin123' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
  let expiredRejected = true;
  try {
    jwt.verify(expiredToken, process.env.JWT_SECRET);
    expiredRejected = false;
  } catch (e) {
    expiredRejected = true;
  }
  const pass6 = expiredRejected === true;
  if (!pass6) allPassed = false;
  console.log(`${pass6 ? '✔' : '✘ GAGAL'} Token yang sudah kedaluwarsa ditolak\n`);

  console.log(allPassed ? 'Semua test auth admin LOLOS.' : 'ADA TEST AUTH ADMIN YANG GAGAL.');
}

main();
