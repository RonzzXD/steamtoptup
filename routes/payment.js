const express = require('express');
const Order = require('../db/models/Order');
const Account = require('../db/models/Account');
const Token = require('../db/models/Token');
const { verifyNotificationSignature } = require('../services/midtrans');

const router = express.Router();

const TOKEN_EXPIRY_MINUTES = parseInt(process.env.TOKEN_EXPIRY_MINUTES || '180', 10);

// Webhook notifikasi dari Midtrans. Daftarkan URL ini
// (https://domainanda.com/api/payment/notification) di dashboard Midtrans
// (Settings -> Configuration -> Payment Notification URL).
router.post('/notification', async (req, res) => {
  const body = req.body || {};
  const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = body;

  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return res.status(400).json({ error: 'Payload notifikasi tidak lengkap.' });
  }

  let validSignature = false;
  try {
    validSignature = verifyNotificationSignature({ order_id, status_code, gross_amount, signature_key });
  } catch (e) {
    console.error('Gagal verifikasi signature Midtrans:', e.message);
    return res.status(500).json({ error: 'Konfigurasi server bermasalah.' });
  }

  if (!validSignature) {
    console.warn('Notifikasi Midtrans dengan signature TIDAK VALID diabaikan. order_id:', order_id);
    return res.status(403).json({ error: 'Signature tidak valid.' });
  }

  const order = await Order.findOne({ orderId: order_id });
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });

  const isSuccess =
    transaction_status === 'settlement' ||
    (transaction_status === 'capture' && fraud_status === 'accept');
  const isFailed = ['deny', 'cancel', 'expire'].includes(transaction_status);

  if (isSuccess && order.status === 'pending') {
    order.status = 'paid';
    order.paidAt = new Date();

    // Coba fulfill otomatis: cari 1 akun 'available' untuk produk yang dibeli.
    const account = await Account.findOne({ productId: order.productId, status: 'available' });

    if (account) {
      const token = await Token.create({
        accountId: account._id,
        orderId: order._id,
        note: order.buyerName || order.orderId,
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000),
      });

      account.status = 'assigned';
      await account.save();

      order.status = 'fulfilled';
      order.tokenId = token._id;
    } else {
      // Sudah dibayar tapi stok kosong -> admin perlu fulfill manual dari admin panel.
      order.status = 'paid_no_stock';
    }

    await order.save();
  } else if (isFailed && order.status === 'pending') {
    order.status = transaction_status === 'expire' ? 'expired' : 'failed';
    await order.save();
  }

  res.json({ ok: true });
});

module.exports = router;
