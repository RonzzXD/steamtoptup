const { Schema, model } = require('mongoose');

const productSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 }, // dalam Rupiah, bilangan bulat
  active: { type: Boolean, default: true }, // kalau false, tidak tampil di toko
}, { timestamps: true });

module.exports = model('Product', productSchema);
