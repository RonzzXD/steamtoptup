const express = require('express');
const requireAdminAuth = require('../middleware/requireAdminAuth');
const Product = require('../db/models/Product');
const Account = require('../db/models/Account');
const Order = require('../db/models/Order');
const Token = require('../db/models/Token');

const router = express.Router();
router.use(requireAdminAuth);

const TOKEN_EXPIRY_MINUTES = parseInt(process.env.TOKEN_EXPIRY_MINUTES || '180', 10);

// ================= Products (item di toko) =================

router.post('/products', async (req, res) => {
  const { name, description, price } = req.body;
  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'Nama & harga wajib diisi.' });
  }
  const product = await Product.create({ name, description: description || '', price });
  res.json(product);
});

router.get('/products', async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
});

router.patch('/products/:id', async (req, res) => {
  const { name, description, price, active } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (price !== undefined) update.price = price;
  if (active !== undefined) update.active = active;

  const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  res.json(product);
});

router.delete('/products/:id', async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ================= Accounts (stok kredensial per produk) =================

router.post('/accounts', async (req, res) => {
  const {
    productId, label, steamUsername, steamPassword,
    email, emailPassword, imapHost, imapPort, imapSecure,
  } = req.body;

  if (!productId || !label || !steamUsername || !steamPassword || !email || !emailPassword || !imapHost) {
    return res.status(400).json({ error: 'Semua field wajib diisi.' });
  }

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });

  const account = await Account.create({
    productId, label, steamUsername, steamPassword,
    email, emailPassword, imapHost,
    imapPort: imapPort || 993,
    imapSecure: imapSecure === false ? false : true,
  });

  res.json({ id: account._id });
});

router.get('/accounts', async (req, res) => {
  const accounts = await Account.find().populate('productId', 'name').sort({ createdAt: -1 });
  res.json(accounts.map((a) => ({
    id: a._id,
    label: a.label,
    steamUsername: a.steamUsername,
    email: a.email,
    status: a.status,
    productId: a.productId ? a.productId._id : null,
    productName: a.productId ? a.productId.name : '(produk dihapus)',
    createdAt: a.createdAt,
  })));
});

router.delete('/accounts/:id', async (req, res) => {
  await Account.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ================= Orders =================

router.get('/orders', async (req, res) => {
  const orders = await Order.find().populate('productId', 'name').populate('tokenId', 'token').sort({ createdAt: -1 }).limit(300);
  res.json(orders.map((o) => ({
    id: o._id,
    orderId: o.orderId,
    productName: o.productId ? o.productId.name : '(produk dihapus)',
    productId: o.productId ? o.productId._id : null,
    buyerName: o.buyerName,
    buyerContact: o.buyerContact,
    amount: o.amount,
    paymentMethod: o.paymentMethod,
    status: o.status,
    token: o.tokenId ? o.tokenId.token : null,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
  })));
});

// Fulfill manual: order sudah dibayar (status 'paid_no_stock') tapi stok akun kosong
// saat itu -> admin assign akun secara manual setelah nambah stok.
router.post('/orders/:id/fulfill', async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId wajib diisi.' });

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });
  if (order.status !== 'paid' && order.status !== 'paid_no_stock') {
    return res.status(400).json({ error: 'Order ini belum berstatus dibayar, atau sudah di-fulfill sebelumnya.' });
  }

  const account = await Account.findById(accountId);
  if (!account || account.status !== 'available') {
    return res.status(400).json({ error: 'Akun tidak tersedia (mungkin sudah dipakai order lain).' });
  }

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
  await order.save();

  res.json({ ok: true, token: token.token });
});

// ================= Tokens (generate manual, di luar alur order/pembayaran) =================

router.post('/tokens', async (req, res) => {
  const { accountId, note } = req.body;
  if (!accountId) return res.status(400).json({ error: 'accountId wajib diisi.' });

  const account = await Account.findById(accountId);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan.' });

  const token = await Token.create({
    accountId: account._id,
    note: note || null,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000),
  });

  res.json({ token: token.token, expires_at: token.expiresAt });
});

router.get('/tokens', async (req, res) => {
  const tokens = await Token.find().populate('accountId', 'label steamUsername').sort({ createdAt: -1 }).limit(300);
  res.json(tokens.map((t) => ({
    id: t._id,
    token: t.token,
    note: t.note,
    status: t.status,
    expires_at: t.expiresAt,
    code_request_count: t.codeRequestCount,
    account_label: t.accountId ? t.accountId.label : '(akun dihapus)',
    createdAt: t.createdAt,
  })));
});

router.delete('/tokens/:id', async (req, res) => {
  await Token.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
