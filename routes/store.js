const express = require('express');
const crypto = require('crypto');
const Product = require('../db/models/Product');
const Order = require('../db/models/Order');
const { createQrisTransaction, createPaymentLink } = require('../services/midtrans');

const router = express.Router();

function generateOrderId() {
  return `INV-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// --- List produk aktif untuk ditampilkan di toko ---
router.get('/products', async (req, res) => {
  const products = await Product.find({ active: true }).sort({ createdAt: -1 });
  res.json(products);
});

// --- Buat order baru + transaksi pembayaran Midtrans ---
router.post('/orders', async (req, res) => {
  const { productId, paymentMethod, buyerName, buyerContact } = req.body;

  if (!productId || !paymentMethod) {
    return res.status(400).json({ error: 'productId dan paymentMethod wajib diisi.' });
  }
  if (!['qris', 'link'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'paymentMethod harus "qris" atau "link".' });
  }

  const product = await Product.findById(productId);
  if (!product || !product.active) {
    return res.status(404).json({ error: 'Produk tidak ditemukan atau sudah tidak dijual.' });
  }

  const orderId = generateOrderId();
  const order = await Order.create({
    orderId,
    productId: product._id,
    buyerName: buyerName || '',
    buyerContact: buyerContact || '',
    amount: product.price,
    paymentMethod,
  });

  try {
    if (paymentMethod === 'qris') {
      const result = await createQrisTransaction({ orderId, grossAmount: product.price });
      order.midtransTransactionId = result.transactionId;
      order.qrisImageUrl = result.qrisImageUrl;
    } else {
      const result = await createPaymentLink({ orderId, grossAmount: product.price, itemName: product.name });
      order.paymentUrl = result.paymentUrl;
    }
    await order.save();
  } catch (err) {
    order.status = 'failed';
    await order.save();
    console.error('Midtrans error:', err.message);
    return res.status(502).json({ error: 'Gagal membuat transaksi pembayaran. Coba lagi sebentar lagi, atau hubungi admin.' });
  }

  res.json({
    orderId: order.orderId,
    qrisImageUrl: order.qrisImageUrl,
    paymentUrl: order.paymentUrl,
    amount: order.amount,
    status: order.status,
  });
});

// --- Cek status order (dipakai buat polling di halaman toko) ---
router.get('/orders/:orderId', async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId })
    .populate('productId', 'name')
    .populate('tokenId', 'token');

  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });

  res.json({
    orderId: order.orderId,
    productName: order.productId ? order.productId.name : null,
    amount: order.amount,
    status: order.status,
    qrisImageUrl: order.qrisImageUrl,
    paymentUrl: order.paymentUrl,
    token: order.tokenId ? order.tokenId.token : null,
  });
});

module.exports = router;
