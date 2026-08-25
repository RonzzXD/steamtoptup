const { Schema, model, Types } = require('mongoose');

const orderSchema = new Schema({
  orderId: { type: String, required: true, unique: true }, // dipakai juga sebagai order_id di Midtrans
  productId: { type: Types.ObjectId, ref: 'Product', required: true },
  buyerName: { type: String, default: '' },
  buyerContact: { type: String, default: '' },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['qris', 'link'], required: true },
  status: {
    type: String,
    // pending: baru dibuat, menunggu bayar
    // paid: sudah dibayar tapi stok akun habis, perlu fulfill manual
    // fulfilled: sudah dibayar & token sudah dibuat otomatis
    // failed / expired: pembayaran gagal / kedaluwarsa
    enum: ['pending', 'paid', 'paid_no_stock', 'fulfilled', 'failed', 'expired'],
    default: 'pending',
  },
  midtransTransactionId: { type: String, default: null },
  qrisImageUrl: { type: String, default: null },
  paymentUrl: { type: String, default: null },
  tokenId: { type: Types.ObjectId, ref: 'Token', default: null },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = model('Order', orderSchema);
