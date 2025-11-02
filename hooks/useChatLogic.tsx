"use client";

import { useEffect, useState, useRef } from "react";
import { socket } from "@/lib/socketClient";

type Msg = { message: string; sender: string; createdAt?: string };
type UserShort = { _id: string; name: string; email?: string };
type Room = { _id?: string; name: string };

export default function useChatLogic() {
  const [room, setRoom] = useState("");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [dmMessages, setDmMessages] = useState<Msg[]>([]);
  const [user, setUser] = useState<{ id: string; name: string; email: string; joinedRooms: string[] } | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [allUsers, setAllUsers] = useState<UserShort[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [chatType, setChatType] = useState<"room" | "dm">("room");
  const [activeDmUser, setActiveDmUser] = useState<UserShort | null>(null);
  const [recentChats, setRecentChats] = useState<UserShort[]>([]);
  const dmRoomRef = useRef<string | null>(null);

  // new additions for your Home.tsx
  const [selectedUser, setSelectedUser] = useState<UserShort | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const handleSelectUser = (u: UserShort) => {
    setSelectedUser(u);
    setSelectedRoom(null);
    openDmWith(u);
  };

  const handleSelectRoom = (r: Room) => {
    setSelectedRoom(r);
    setSelectedUser(null);
    handleJoinRoom(r.name);
  };

  const dmRoomId = (a: string, b: string) => (a < b ? `dm:${a}_${b}` : `dm:${b}_${a}`);

  // Initialize user and fetch data
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

  // Socket listeners
  useEffect(() => {
    const handleRoomMessage = (data: any) => setMessages((p) => [...p, { sender: data.username, message: data.message, createdAt: data.createdAt }]);
    const handleRoomList = (rooms: any[]) => setAvailableRooms(rooms || []);
    const handleUserJoined = (msg: string) => setMessages((p) => [...p, { sender: "system", message: msg }]);
    const handleRoomMessages = (msgs: any[]) => setMessages(msgs.map((m) => ({ sender: m.sender, message: m.message, createdAt: m.createdAt })));

    const handleDirect = (data: any) => {
      const { fromUserName, message, createdAt, dmRoom, self, fromUserId, toUserId } = data;
      if (dmRoom && dmRoomRef.current === dmRoom)
        setDmMessages((p) => [...p, { sender: fromUserName || (self ? "You" : "unknown"), message, createdAt }]);
      if (user) {
        const otherId = self ? toUserId : fromUserId;
        if (otherId && otherId !== user.id) {
          const found = allUsers.find((u) => u._id === otherId);
          const chatUser = found || { _id: otherId, name: fromUserName || "Unknown", email: "" };
          setRecentChats((p) => {
            const filtered = p.filter((x) => x._id !== chatUser._id);
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
  }, [user, allUsers]);

  // Fetch rooms
  const fetchRooms = async () => {
    try {
      const res = await fetch("/api/rooms/get");
      const data = await res.json();
      if (data.ok) setAvailableRooms(data.rooms || []);
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  };

  // Fetch users
  const fetchUsers = async (q: string) => {
    try {
      const res = await fetch(`/api/user/get${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const data = await res.json();
      if (data.ok) setAllUsers(data.users || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  // Send message
  const handleSendMessage = (message: string) => {
    if (!message.trim()) return;
    if (chatType === "room" && room) {
      socket.emit("send-message", { room, username: user?.name, message });
    } else if (activeDmUser && user) {
      socket.emit(
        "send-direct",
        { toUserId: activeDmUser._id, toUserName: activeDmUser.name, fromUserId: user.id, fromUserName: user.name, message },
        (res: any) => !res?.success && console.error("send-direct failed", res)
      );
      const dmRoom = dmRoomId(user.id, activeDmUser._id);
      dmRoomRef.current = dmRoom;
      setDmMessages((p) => [...p, { sender: user.name, message, createdAt: new Date().toISOString() }]);
    }
  };

  // Join room
  const handleJoinRoom = async (roomName: string) => {
    if (!user) return alert("Please login or register first.");
    socket.emit("join-room", { username: user.name, room: roomName }, (res: any) => {
      if (res?.success) {
        setRoom(roomName);
        setChatType("room");
        setJoined(true);
        setMessages([]);
      } else alert("Failed to join room: " + (res?.error || "unknown"));
    });
  };

  // Create room
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

  // DM open
  const openDmWith = (u: UserShort) => {
    if (!user) return alert("Please login first");
    setActiveDmUser(u);
    setChatType("dm");
    setDmMessages([]);
    const dmRoom = dmRoomId(user.id, u._id);
    dmRoomRef.current = dmRoom;
    socket.emit("get-dm-messages", { dmRoom }, (res: any) => {
      if (res?.success)
        setDmMessages(res.messages.map((m: any) => ({ sender: m.sender, message: m.message, createdAt: m.createdAt })));
    });
  };

  // Logout
  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
    setJoined(false);
    setRoom("");
    setMessages([]);
    setDmMessages([]);
  };

  return {
    room,
    joined,
    messages,
    dmMessages,
    user,
    availableRooms,
    allUsers,
    searchQ,
    setSearchQ,
    newRoomName,
    setNewRoomName,
    chatType,
    setChatType,
    activeDmUser,
    setActiveDmUser,
    recentChats,
    selectedUser,
    selectedRoom,
    handleSelectUser,
    handleSelectRoom,
    handleSendMessage,
    handleJoinRoom,
    handleCreateRoom,
    openDmWith,
    handleLogout,
  };
}
