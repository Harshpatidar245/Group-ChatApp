"use client";
import ChatForm from "@/components/ChatForm";
import ChatMessage from "@/components/ChatMessage";
import { useEffect, useState, useRef } from "react";
import { socket } from "@/lib/socketClient";
import Link from "next/link";

type Msg = { message: string; sender: string; createdAt?: string };
type UserShort = { _id: string; name: string; email?: string };

export default function Home() {
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [dmMessages, setDmMessages] = useState<Msg[]>([]);
  const [user, setUser] = useState<{ id: string; name: string; email: string; joinedRooms: string[] } | null>(null);
  const [availableRooms, setAvailableRooms] = useState<{ name: string }[]>([]);
  const [allUsers, setAllUsers] = useState<UserShort[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [chatType, setChatType] = useState<"room" | "dm">("room");
  const [activeDmUser, setActiveDmUser] = useState<UserShort | null>(null);
  const [recentChats, setRecentChats] = useState<UserShort[]>([]);
  const dmRoomRef = useRef<string | null>(null);

  const dmRoomId = (a: string, b: string) => (a < b ? `dm:${a}_${b}` : `dm:${b}_${a}`);

  // 1. Fetch user, rooms, users once
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch("/api/user");
        const data = await res.json();
        if (data?.ok && data?.user) {
          setUser(data.user);
          socket.emit("register", { userId: data.user.id, name: data.user.name });
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }

      await fetchRooms();
      await fetchUsers("");
      socket.emit("get-rooms");
    };

    init();
  }, []);

  // 2. Socket listeners (run once)
  useEffect(() => {
    const handleRoomMessage = (data: { username: string; message: string; createdAt?: string }) => {
      setMessages((prev) => [...prev, { sender: data.username, message: data.message, createdAt: data.createdAt }]);
    };

    const handleRoomList = (rooms: { name: string }[]) => setAvailableRooms(rooms || []);

    const handleUserJoined = (msg: string) => setMessages((prev) => [...prev, { sender: "system", message: msg }]);

    const handleRoomMessages = (msgs: { sender: string; message: string; createdAt?: string }[]) =>
      setMessages(msgs.map((m) => ({ sender: m.sender, message: m.message, createdAt: m.createdAt })));

    const handleDirect = (data: any) => {
      const { fromUserName, message, createdAt, dmRoom, self, fromUserId, toUserId } = data;
      if (dmRoom && dmRoomRef.current === dmRoom) {
        setDmMessages((prev) => [...prev, { sender: fromUserName || (self ? "You" : "unknown"), message, createdAt }]);
      }
      if (user) {
        const otherId = self ? toUserId : fromUserId;
        if (otherId && otherId !== user.id) {
          const found = allUsers.find((u) => u._id === otherId);
          const chatUser = found || { _id: otherId, name: fromUserName || "Unknown", email: "" };
          setRecentChats((prev) => {
            const filtered = prev.filter((p) => p._id !== chatUser._id);
            return [chatUser, ...filtered].slice(0, 10);
          });
        }
      }
    };

    socket.on("receive-message", handleRoomMessage);
    socket.on("rooms-list", handleRoomList);
    socket.on("user_joined", handleUserJoined);
    socket.on("room-messages", handleRoomMessages);
    socket.on("receive-direct", handleDirect);

    return () => {
      socket.off("receive-message", handleRoomMessage);
      socket.off("rooms-list", handleRoomList);
      socket.off("user_joined", handleUserJoined);
      socket.off("room-messages", handleRoomMessages);
      socket.off("receive-direct", handleDirect);
    };
  }, [allUsers, user]);

  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/rooms/get");
      const data = await res.json();
      if (data.ok) setAvailableRooms(data.rooms || []);
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  };

  const fetchUsers = async (q: string) => {
    try {
      const url = `/api/user/get${q ? `?q=${encodeURIComponent(q)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) setAllUsers(data.users || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const handleSendMessage = (message: string) => {
    if (!message.trim()) return;
    if (chatType === "room") {
      if (!room) return;
      socket.emit("send-message", { room, username: user?.name || "unknown", message });
    } else if (activeDmUser && user) {
      socket.emit(
        "send-direct",
        {
          toUserId: activeDmUser._id,
          toUserName: activeDmUser.name,
          fromUserId: user.id,
          fromUserName: user.name,
          message,
        },
        (res: any) => {
          if (!res?.success) console.error("send-direct failed", res);
        }
      );
      const dmRoom = dmRoomId(user.id, activeDmUser._id);
      dmRoomRef.current = dmRoom;
      setDmMessages((prev) => [...prev, { sender: user.name, message, createdAt: new Date().toISOString() }]);
      setRecentChats((prev) => {
        const filtered = prev.filter((p) => p._id !== activeDmUser._id);
        return [activeDmUser, ...filtered].slice(0, 10);
      });
    }
  };

  const handleJoinRoom = async (roomName: string) => {
    if (!user) return alert("Please login or register first.");
    socket.emit("join-room", { username: user.name, room: roomName }, (response: any) => {
      if (response?.success) {
        setRoom(roomName);
        setChatType("room");
        setJoined(true);
        setMessages([]);
      } else alert("Failed to join room: " + (response?.error || "unknown"));
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
        await fetchRooms();
      } else alert("Failed to create room: " + (res?.error || "unknown"));
    });
  };

  const openDmWith = (u: UserShort) => {
    if (!user) return alert("Please login first");
    setActiveDmUser(u);
    setChatType("dm");
    setDmMessages([]);
    const dmRoom = dmRoomId(user.id, u._id);
    dmRoomRef.current = dmRoom;

    socket.emit("get-dm-messages", { dmRoom }, (res: any) => {
      if (res?.success) {
        setDmMessages(res.messages.map((m: any) => ({ sender: m.sender, message: m.message, createdAt: m.createdAt })));
      } else console.error("Failed to load DM messages", res?.error);
    });

    setRecentChats((prev) => {
      const filtered = prev.filter((p) => p._id !== u._id);
      return [u, ...filtered].slice(0, 10);
    });
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      setUser(null);
      setJoined(false);
      setRoom("");
      setMessages([]);
      setDmMessages([]);
    } catch {
      alert("Logout failed. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-start justify-center py-12 px-4">
      {!user ? (
        <div className="max-w-md w-full bg-white/90 backdrop-blur-md p-8 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Welcome to ChatApp</h2>
          <p className="text-center text-gray-600 mb-8">Please log in or register to start chatting.</p>
          <div className="flex justify-center gap-4">
            <Link href="/login">
              <button className="px-5 py-2 bg-blue-600 hover:bg-blue-700 transition text-white rounded-lg shadow">Login</button>
            </Link>
            <Link href="/register">
              <button className="px-5 py-2 bg-green-600 hover:bg-green-700 transition text-white rounded-lg shadow">Register</button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sidebar */}
          <aside className="col-span-1 bg-white/90 p-5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Users</h3>
              <button onClick={handleLogout} className="px-3 py-1 bg-red-500 text-white rounded-md">Logout</button>
            </div>

            <div className="mb-4">
              <input
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  fetchUsers(e.target.value);
                }}
                placeholder="Search users..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none"
              />
            </div>

            <div className="space-y-2 max-h-[240px] overflow-y-auto mb-4">
              {allUsers.length
                ? allUsers.map((u) => (
                    <div key={u._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <div>
                        <div className="font-medium text-gray-800">{u.name}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </div>
                      <button onClick={() => openDmWith(u)} className="px-2 py-1 bg-blue-600 text-white rounded-md text-sm">Message</button>
                    </div>
                  ))
                : <div className="text-sm text-gray-500">No users found.</div>}
            </div>

            <h4 className="text-sm font-semibold mb-2">Recent Chats</h4>
            <div className="space-y-2 max-h-[180px] overflow-y-auto">
              {recentChats.length
                ? recentChats.map((r) => (
                    <div key={r._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-gray-500">{r.email}</div>
                      </div>
                      <button onClick={() => openDmWith(r)} className="px-2 py-1 bg-blue-500 text-white rounded-md text-sm">Open</button>
                    </div>
                  ))
                : <div className="text-sm text-gray-500">No recent chats</div>}
            </div>
          </aside>

          {/* Rooms */}
          <section className="col-span-1 bg-white/90 p-5 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Rooms</h3>
              <div className="text-sm text-gray-500">Public</div>
            </div>

            <div className="mb-4 flex gap-2">
              <input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="New room name"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300"
              />
              <button onClick={handleCreateRoom} className="px-3 py-2 bg-green-600 text-white rounded-lg">Create</button>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {availableRooms.map((r) => (
                <div key={r.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 border">
                  <div className="font-medium">{r.name}</div>
                  <button onClick={() => handleJoinRoom(r.name)} className="px-2 py-1 bg-blue-600 text-white rounded-md text-sm">Join</button>
                </div>
              ))}
            </div>
          </section>

          {/* Chat Area */}
          <main className="col-span-1 bg-white/90 p-5 rounded-2xl shadow-lg flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">
                  {chatType === "room" ? `Room: ${room || "— not joined —"}` : `DM with: ${activeDmUser?.name || "—"}`}
                </h3>
                <div className="text-xs text-gray-500">
                  {chatType === "room" ? "Public room chat" : "Private conversation"}
                </div>
              </div>
              <div className="flex gap-2">
                {chatType === "dm" && (
                  <button onClick={() => { setChatType("room"); setActiveDmUser(null); dmRoomRef.current = null; setDmMessages([]); }} className="px-3 py-1 bg-gray-300 rounded-md">
                    Back
                  </button>
                )}
                {joined && chatType === "room" && (
                  <button onClick={() => { setJoined(false); setRoom(""); setMessages([]); }} className="px-3 py-1 bg-gray-300 rounded-md">
                    Leave
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 mb-4 bg-gray-100 rounded-lg">
              {(chatType === "room" ? messages : dmMessages).length === 0 ? (
                <div className="text-center text-gray-500 mt-8">No messages yet.</div>
              ) : (
                (chatType === "room" ? messages : dmMessages).map((m, i) => (
                  <ChatMessage key={i} sender={m.sender} message={m.message} isOwnMessage={m.sender === user?.name} />
                ))
              )}
            </div>

            <ChatForm onSendMessage={handleSendMessage} />
          </main>
        </div>
      )}
    </div>
  );
}





















// "use client";

// import useChatLogic from "@/hooks/useChatLogic";
// import AuthSection from "@/components/chat/AuthSection";
// import SidebarUsers from "@/components/chat/SidebarUsers";
// import RoomsSection from "@/components/chat/RoomsSection";
// import ChatArea from "@/components/chat/ChatArea";

// export default function Home() {
//   const chat = useChatLogic();

//   if (!chat.user) {
//     return (
//       <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
//         <AuthSection />
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-start justify-center py-12 px-4">
//       <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6">
//         {/* Users Sidebar */}
//         <SidebarUsers
//           onSelectUser={chat.handleSelectUser}
//           selectedUserId={chat.selectedUser?._id}
//         />

//         {/* Rooms Sidebar */}
//         <RoomsSection
//           onSelectRoom={chat.handleSelectRoom}
//           selectedRoomId={chat.selectedRoom?._id}
//         />

//         {/* Chat Area */}
//         <ChatArea
//           roomId={chat.selectedRoom?._id}
//           userId={chat.user.id}
//           recipientId={chat.selectedUser?._id}
//           title={
//             chat.selectedRoom
//               ? `Room: ${chat.selectedRoom.name}`
//               : chat.selectedUser
//               ? `Chat with ${chat.selectedUser.name}`
//               : "Select a chat"
//           }
//         />
//       </div>
//     </div>
//   );
// }
