const { Schema, model, Types } = require('mongoose');
const crypto = require('crypto');

const tokenSchema = new Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(9).toString('base64url'),
  },
  accountId: { type: Types.ObjectId, ref: 'Account', required: true },
  orderId: { type: Types.ObjectId, ref: 'Order', default: null }, // null kalau token dibuat manual oleh admin
  note: { type: String, default: null },
  status: { type: String, enum: ['unused', 'credentials_viewed', 'code_viewed'], default: 'unused' },
  expiresAt: { type: Date, required: true },
  credentialsViewedAt: { type: Date, default: null },
  codeViewedAt: { type: Date, default: null },
  codeRequestCount: { type: Number, default: 0 }, // berapa kali BERHASIL ambil kode
}, { timestamps: true });

module.exports = model('Token', tokenSchema);
