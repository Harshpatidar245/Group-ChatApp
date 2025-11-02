import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { connectDB } from "./lib/db.ts"; // must end with .js if transpiled output is JS
import Room from "./models/Room.js";
import Message from "./models/Message.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = Number(process.env.PORT) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }

  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Send all rooms to client immediately
    socket.on("get-rooms", async () => {
      try {
        const rooms = await Room.find({}, { name: 1, createdAt: 1 })
          .sort({ createdAt: -1 })
          .lean();
        socket.emit("rooms-list", rooms);
      } catch (err) {
        console.error("❌ get-rooms error:", err);
      }
    });

    // Create room
    socket.on("create-room", async (payload: { name: string }, callback?: (res: any) => void) => {
      const { name } = payload || {};
      if (!name?.trim()) return callback?.({ success: false, error: "Invalid room name" });

      try {
        await connectDB(); // ensure connection before DB ops
        const existing = await Room.findOne({ name }).lean();
        if (existing) return callback?.({ success: false, error: "Room already exists" });

        const room = new Room({ name });
        await room.save();

        const rooms = await Room.find({}, { name: 1, createdAt: 1 })
          .sort({ createdAt: -1 })
          .lean();

        io.emit("rooms-list", rooms);
        callback?.({ success: true, room });
      } catch (err) {
        console.error("❌ create-room error:", err);
        callback?.({ success: false, error: String(err) });
      }
    });

    // Join room
    socket.on("join-room", async (payload: { room: string; username: string }, callback?: (res: any) => void) => {
      const { room, username } = payload || {};
      if (!room || !username) return callback?.({ success: false, error: "Missing room or username" });

      try {
        socket.join(room);
        socket.to(room).emit("user_joined", `${username} joined ${room}`);

        const messages = await Message.find({ room }).sort({ createdAt: 1 }).lean();
        socket.emit("room-messages", messages);

        callback?.({ success: true });
      } catch (err) {
        console.error("❌ join-room error:", err);
        callback?.({ success: false, error: String(err) });
      }
    });

    // Send message
    socket.on("send-message", async (payload: { room: string; username: string; message: string }) => {
      const { room, username, message } = payload || {};
      if (!room || !username || !message) return;
      try {
        await connectDB();
        const msg = await Message.create({ room, sender: username, message });
        io.to(room).emit("receive-message", { username, message, createdAt: msg.createdAt });
      } catch (err) {
        console.error("❌ send-message error:", err);
      }
    });

    socket.on("disconnect", () => console.log("User disconnected:", socket.id));
  });

  httpServer.listen(port, () =>
    console.log(`🚀 Server running at http://${hostname}:${port}`)
  );
});
