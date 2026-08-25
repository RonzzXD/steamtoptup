// Wrapper tipis untuk API Midtrans. Pakai fetch bawaan Node (Node 18+), tidak perlu
// dependency tambahan untuk HTTP request.
const crypto = require('crypto');

function getServerKey() {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) throw new Error('MIDTRANS_SERVER_KEY belum diisi di .env');
  return key;
}

function isProduction() {
  return process.env.MIDTRANS_IS_PRODUCTION === 'true';
}

function coreApiBase() {
  return isProduction() ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
}

function paymentLinkBase() {
  // Payment Link API pakai host yang sama dengan Core API
  return isProduction() ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
}

function authHeader() {
  const token = Buffer.from(`${getServerKey()}:`).toString('base64');
  return `Basic ${token}`;
}

/**
 * Buat transaksi QRIS lewat Midtrans Core API.
 * Return: { transactionId, qrisImageUrl, raw }
 */
async function createQrisTransaction({ orderId, grossAmount }) {
  const res = await fetch(`${coreApiBase()}/v2/charge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader(),
    },
    body: JSON.stringify({
      payment_type: 'qris',
      transaction_details: { order_id: orderId, gross_amount: grossAmount },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.status_message || `Midtrans QRIS error (HTTP ${res.status})`);
  }

  const qrAction = (data.actions || []).find((a) => a.name === 'generate-qr-code');

  return {
    transactionId: data.transaction_id,
    qrisImageUrl: qrAction ? qrAction.url : null,
    raw: data,
  };
}

/**
 * Buat Payment Link lewat Midtrans Payment Link API (customer bisa bayar
 * pakai metode apa saja yang didukung Midtrans, termasuk QRIS, di halaman itu).
 * Return: { paymentUrl, raw }
 */
async function createPaymentLink({ orderId, grossAmount, itemName, expiryMinutes }) {
  const res = await fetch(`${paymentLinkBase()}/v1/payment-links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader(),
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: grossAmount },
      item_details: [{ id: orderId, price: grossAmount, quantity: 1, name: (itemName || 'Produk').slice(0, 50) }],
      usage_limit: 1,
      expiry: { duration: expiryMinutes || 60, unit: 'minutes' },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = (data.error_messages && data.error_messages.join(', ')) || `Midtrans Payment Link error (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return { paymentUrl: data.payment_url, raw: data };
}

/**
 * Verifikasi signature notifikasi webhook Midtrans.
 * Rumus resmi: SHA512(order_id + status_code + gross_amount + ServerKey)
 */
function verifyNotificationSignature({ order_id, status_code, gross_amount, signature_key }) {
  const expected = crypto
    .createHash('sha512')
    .update(`${order_id}${status_code}${gross_amount}${getServerKey()}`)
    .digest('hex');
  return expected === signature_key;
}

module.exports = { createQrisTransaction, createPaymentLink, verifyNotificationSignature };
