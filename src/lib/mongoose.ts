import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

// Global cached connection for serverless environments (Next.js/Vercel)
const cached = global.mongoose ?? { conn: null, promise: null };
global.mongoose = cached;

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      dbName: process.env.DB_NAME || 'dreamshift', // ← FIX: was defaulting to 'test'
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((m) => {
      return m;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;
