"use client";
import ChatForm from "@/components/ChatForm";
import ChatMessage from "@/components/ChatMessage";
import { useEffect, useState } from "react";
import { socket } from "@/lib/socketClient";
import Link from "next/link";

type Msg = { message: string; sender: string; createdAt?: string };

export default function Home() {
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [user, setUser] = useState<{ id: string; name: string; email: string; joinedRooms: string[] } | null>(null);
  const [availableRooms, setAvailableRooms] = useState<{ name: string }[]>([]);
  const [newRoomName, setNewRoomName] = useState("");

  // Fetch user and rooms on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user");
        const data = await res.json();
        if (data?.ok && data?.user) setUser(data.user);
      } catch {
        console.error("Failed to fetch user");
      }

      // Fetch all rooms from DB (not just sockets)
      await fetchRooms();
    })();

    socket.on("receive-message", (data: { username: string; message: string; createdAt?: string }) => {
      setMessages((prev) => [...prev, { sender: data.username, message: data.message, createdAt: data.createdAt }]);
    });

    socket.on("rooms-list", (rooms: { name: string }[]) => setAvailableRooms(rooms || []));
    socket.on("user_joined", (msg: string) => setMessages((prev) => [...prev, { sender: "system", message: msg }]));
    socket.on("room-messages", (msgs: { sender: string; message: string; createdAt?: string }[]) =>
      setMessages(msgs.map((m) => ({ sender: m.sender, message: m.message, createdAt: m.createdAt })))
    );

    socket.emit("get-rooms");

    return () => {
      socket.off("receive-message");
      socket.off("rooms-list");
      socket.off("user_joined");
      socket.off("room-messages");
    };
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/rooms/get");
      const data = await res.json();
      if (data.ok) setAvailableRooms(data.rooms || []);
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  };

  const handleSendMessage = (message: string) => {
    if (!message.trim() || !room) return;
    socket.emit("send-message", { room, username: user?.name || "unknown", message });
  };

  const handleJoinRoom = async (roomName: string) => {
    if (!user) {
      alert("Please login or register first.");
      return;
    }

    socket.emit("join-room", { username: user.name, room: roomName }, (response: { success: boolean; error?: string }) => {
      if (response?.success) {
        setRoom(roomName);
        setJoined(true);
      } else {
        alert("Failed to join room: " + (response?.error || "unknown"));
      }
    });

    try {
      await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomName }),
      });
      const ures = await fetch("/api/user");
      const udata = await ures.json();
      if (udata?.ok && udata?.user) setUser(udata.user);
    } catch (e) {
      console.error("Failed to record joined room", e);
    }
  };

  const handleCreateRoom = async () => {
    const name = newRoomName.trim();
    if (!name) return alert("Enter room name");

    socket.emit("create-room", { name }, async (res: any) => {
      if (res?.success) {
        setNewRoomName("");
        await fetchRooms(); // refresh room list from DB
      } else {
        alert("Failed to create room: " + (res?.error || "unknown"));
      }
    });
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      setUser(null);
      setJoined(false);
      setRoom("");
      setMessages([]);
    } catch {
      alert("Logout failed. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-start justify-center py-16 px-4">
      {!user ? (
        <div className="max-w-md w-full bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Welcome to ChatApp</h2>
          <p className="text-center text-gray-600 mb-8">Please log in or register to start chatting.</p>
          <div className="flex justify-center gap-4">
            <Link href="/login">
              <button className="px-5 py-2 bg-blue-600 hover:bg-blue-700 transition text-white rounded-lg shadow">
                Login
              </button>
            </Link>
            <Link href="/register">
              <button className="px-5 py-2 bg-green-600 hover:bg-green-700 transition text-white rounded-lg shadow">
                Register
              </button>
            </Link>
          </div>
        </div>
      ) : !joined ? (
        <div className="w-full max-w-5xl bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Hello, {user.name}</h1>
              <p className="text-gray-600 mt-1">
                You’ve joined <strong>{user.joinedRooms?.length || 0}</strong> room(s)
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 transition text-white rounded-lg shadow"
            >
              Logout
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Create Room */}
            <div>
              <h2 className="text-xl font-semibold text-gray-700 mb-3">Create a New Room</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Enter room name..."
                />
                <button
                  onClick={handleCreateRoom}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition shadow"
                >
                  Create
                </button>
              </div>
            </div>

            {/* Available Rooms */}
            <div>
              <h2 className="text-xl font-semibold text-gray-700 mb-3">Available Rooms</h2>
              <div className="bg-gray-100 rounded-lg p-4 max-h-[400px] overflow-y-auto shadow-inner">
                {availableRooms.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center">No rooms yet.</p>
                ) : (
                  availableRooms.map((r) => (
                    <div
                      key={r.name}
                      className="flex justify-between items-center bg-white hover:bg-gray-50 px-3 py-2 mb-2 rounded-lg border transition"
                    >
                      <span className="text-gray-800 font-medium">{r.name}</span>
                      <button
                        onClick={() => handleJoinRoom(r.name)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition"
                      >
                        Join
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-3xl bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Room: {room}</h1>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setJoined(false);
                  setRoom("");
                  setMessages([]);
                }}
                className="px-3 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg transition"
              >
                Leave
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="h-[500px] overflow-y-auto p-4 mb-4 bg-gray-100 rounded-xl shadow-inner">
            {messages.length === 0 ? (
              <p className="text-center text-gray-500 mt-20">No messages yet. Say something!</p>
            ) : (
              messages.map((msg, index) => (
                <ChatMessage
                  key={index}
                  sender={msg.sender}
                  message={msg.message}
                  isOwnMessage={msg.sender === user.name}
                />
              ))
            )}
          </div>

          <ChatForm onSendMessage={handleSendMessage} />
        </div>
      )}
    </div>
  );
}
