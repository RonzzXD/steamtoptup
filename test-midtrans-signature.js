// Test offline untuk verifikasi signature webhook Midtrans, TANPA perlu koneksi
// internet atau kredensial Midtrans asli — cuma pakai fungsi crypto biasa.
//
// Jalankan dengan: node test-midtrans-signature.js

process.env.MIDTRANS_SERVER_KEY = 'test-server-key-123';

const crypto = require('crypto');
const { verifyNotificationSignature } = require('./services/midtrans');

function computeSignature({ order_id, status_code, gross_amount, serverKey }) {
  return crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest('hex');
}

const validPayload = {
  order_id: 'INV-1234567890-ABCDEF',
  status_code: '200',
  gross_amount: '15000.00',
};

const validSignature = computeSignature({ ...validPayload, serverKey: process.env.MIDTRANS_SERVER_KEY });

const cases = [
  {
    name: 'Signature valid (dihitung dengan server key yang benar)',
    payload: { ...validPayload, signature_key: validSignature },
    expected: true,
  },
  {
    name: 'Signature dipalsukan (asal-asalan)',
    payload: { ...validPayload, signature_key: 'abc123deadbeef' },
    expected: false,
  },
  {
    name: 'Signature dihitung dengan server key yang SALAH (mensimulasikan penyerang tanpa server key asli)',
    payload: { ...validPayload, signature_key: computeSignature({ ...validPayload, serverKey: 'server-key-nebak-nebak' }) },
    expected: false,
  },
  {
    name: 'Payload diubah (gross_amount beda) tapi signature dari payload asli (harus GAGAL karena signature tidak cocok lagi)',
    payload: { ...validPayload, gross_amount: '999999.00', signature_key: validSignature },
    expected: false,
  },
];

let allPassed = true;
for (const c of cases) {
  const result = verifyNotificationSignature(c.payload);
  const pass = result === c.expected;
  if (!pass) allPassed = false;
  console.log(`${pass ? '✔' : '✘ GAGAL'} ${c.name}`);
  console.log(`  -> hasil: ${result} (harusnya: ${c.expected})\n`);
}

console.log(allPassed ? 'Semua test signature LOLOS.' : 'ADA TEST SIGNATURE YANG GAGAL.');
