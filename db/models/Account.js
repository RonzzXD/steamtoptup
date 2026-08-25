const { Schema, model, Types } = require('mongoose');

const accountSchema = new Schema({
  productId: { type: Types.ObjectId, ref: 'Product', required: true },
  label: { type: String, required: true }, // nama internal, mis. "Akun A - Elden Ring"
  steamUsername: { type: String, required: true },
  steamPassword: { type: String, required: true },
  email: { type: String, required: true },       // email terhubung ke akun steam
  emailPassword: { type: String, required: true }, // App Password untuk IMAP
  imapHost: { type: String, required: true },
  imapPort: { type: Number, default: 993 },
  imapSecure: { type: Boolean, default: true },
  status: { type: String, enum: ['available', 'assigned'], default: 'available' },
}, { timestamps: true });

module.exports = model('Account', accountSchema);
