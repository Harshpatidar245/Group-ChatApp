import mongoose from "mongoose";

const mongoUrl = process.env.MONGODB_URI || "mongodb+srv://harpatidar:EPX6Y3zeH4jaQtVL@company.3fvv1ri.mongodb.net/?retryWrites=true&w=majority&appName=Company";

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

