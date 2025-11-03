// server.mts
import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { connectDB } from "./lib/db.ts";
import Room from "./models/Room.js";
import Message from "./models/Message.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = Number(process.env.PORT) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Map userId -> socket.id (store latest socket for user)
const userSocketMap = new Map<string, string>();

function dmRoomId(userA: string, userB: string) {
  // deterministic room id for a DM between two userIds
  const a = String(userA);
  const b = String(userB);
  return a < b ? `dm:${a}_${b}` : `dm:${b}_${a}`;
}

app.prepare().then(async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }

  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // client should emit "register" with { userId, name } after connecting
    socket.on("register", (payload: { userId: string; name?: string }) => {
      if (!payload?.userId) return;
      userSocketMap.set(payload.userId, socket.id);
      socket.data.userId = payload.userId;
      socket.data.name = payload.name;
      console.log(`Registered socket ${socket.id} for user ${payload.userId}`);
    });

    // Send all rooms to client immediately
    socket.on("get-rooms", async () => {
      try {
        const rooms = await Room.find({}, { name: 1, createdAt: 1 }).sort({ createdAt: -1 }).lean();
        socket.emit("rooms-list", rooms);
      } catch (err) {
        console.error("get-rooms error:", err);
      }
    });

    // Create room
    socket.on("create-room", async (payload: { name: string }, callback?: (res: any) => void) => {
      const { name } = payload || {};
      if (!name?.trim()) return callback?.({ success: false, error: "Invalid room name" });

      try {
        await connectDB();
        const existing = await Room.findOne({ name }).lean();
        if (existing) return callback?.({ success: false, error: "Room already exists" });

        const room = new Room({ name });
        await room.save();

        const rooms = await Room.find({}, { name: 1, createdAt: 1 }).sort({ createdAt: -1 }).lean();
        io.emit("rooms-list", rooms);
        callback?.({ success: true, room });
      } catch (err) {
        console.error("create-room error:", err);
        callback?.({ success: false, error: String(err) });
      }
    });

    // Join room (public room)
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
        console.error("join-room error:", err);
        callback?.({ success: false, error: String(err) });
      }
    });

    // Send message to room
    socket.on("send-message", async (payload: { room: string; username: string; message: string }) => {
      const { room, username, message } = payload || {};
      if (!room || !username || !message) return;
      try {
        await connectDB();
        const msg = await Message.create({ room, sender: username, message });
        io.to(room).emit("receive-message", { username, message, createdAt: msg.createdAt });
      } catch (err) {
        console.error("send-message error:", err);
      }
    });

    // Send direct message (DM)
    // payload: { toUserId, toUserName, fromUserId, fromUserName, message }
    socket.on(
      "send-direct",
      async (payload: { toUserId: string; toUserName?: string; fromUserId: string; fromUserName?: string; message: string }, callback?: (res: any) => void) => {
        const { toUserId, fromUserId, fromUserName, fromUserName: fname, message } = payload || {};
        if (!toUserId || !fromUserId || !message) return callback?.({ success: false, error: "Missing fields" });

        try {
          await connectDB();
          // deterministic DM room id
          const dmRoom = dmRoomId(fromUserId, toUserId);
          const msg = await Message.create({ room: dmRoom, sender: fromUserName || String(fromUserId), message });

          // send to recipient if connected
          const recipientSocketId = userSocketMap.get(toUserId);
          if (recipientSocketId) {
            io.to(recipientSocketId).emit("receive-direct", {
              fromUserId,
              fromUserName,
              message,
              createdAt: msg.createdAt,
              dmRoom,
            });
          }

          // send to sender so sender UI also receives it
          socket.emit("receive-direct", {
            fromUserId,
            fromUserName,
            toUserId,
            message,
            createdAt: msg.createdAt,
            dmRoom,
            self: true,
          });

          callback?.({ success: true, msg });
        } catch (err) {
          console.error("send-direct error:", err);
          callback?.({ success: false, error: String(err) });
        }
      }
    );

    // Request to load DM messages for a given dmRoom id (dm:small_big)
    socket.on("get-dm-messages", async (payload: { dmRoom: string }, callback?: (res: any) => void) => {
      const { dmRoom } = payload || {};
      if (!dmRoom) return callback?.({ success: false, error: "Missing dmRoom" });
      try {
        const msgs = await Message.find({ room: dmRoom }).sort({ createdAt: 1 }).lean();
        callback?.({ success: true, messages: msgs });
      } catch (err) {
        console.error("get-dm-messages error:", err);
        callback?.({ success: false, error: String(err) });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      // remove from userSocketMap if it was mapped to this socket
      for (const [uid, sid] of userSocketMap.entries()) {
        if (sid === socket.id) userSocketMap.delete(uid);
      }
    });
  });

  httpServer.listen(port, () => console.log(`Server running at http://${hostname}:${port}`));
});
