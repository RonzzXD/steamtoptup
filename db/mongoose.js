const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI belum diisi di .env. Isi dengan connection string MongoDB Anda (lokal atau MongoDB Atlas).');
  }
  await mongoose.connect(uri);
  console.log('✔ Terhubung ke MongoDB');
}

module.exports = { connectDB, mongoose };
