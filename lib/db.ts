import mongoose from "mongoose";

const mongoUrl = process.env.MONGODB_URI || ""
let cached = (global as any)._mongoose;
if (!cached) cached = (global as any)._mongoose = { conn: null, promise: null };

export async function connectDB() {
  if (mongoose.connection.readyState >= 1) return mongoose.connection;
  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUrl, {
      dbName: "ChatApp",
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

