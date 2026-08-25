const { Schema, model } = require('mongoose');

const adminSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true },
  keyHash: { type: String, required: true }, // hash bcrypt dari admin key, TIDAK disimpan plain-text
}, { timestamps: true });

module.exports = model('Admin', adminSchema);
