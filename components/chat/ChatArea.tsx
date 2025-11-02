"use client";
import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const socket = io();

interface ChatAreaProps {
  roomId?: string;
  userId: string;
  recipientId?: string;
  title: string;
}

interface Message {
  _id?: string;
  sender: string;
  message: string;
  createdAt: string;
}

export default function ChatArea({
  roomId,
  userId,
  recipientId,
  title,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMessages = async () => {
      if (!roomId && !recipientId) return;
      const res = await fetch(
        roomId
          ? `/api/messages/get?room=${roomId}`
          : `/api/messages/get?direct=${recipientId}`
      );
      const data = await res.json();
      if (data.ok) setMessages(data.messages);
    };
    loadMessages();
  }, [roomId, recipientId]);

  useEffect(() => {
    const handleMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    };
    socket.on("receive-message", handleMessage);
    return () => {
      socket.off("receive-message", handleMessage);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    const payload = {
      sender: userId,
      message: input,
      room: roomId || null,
      recipient: recipientId || null,
    };
    socket.emit("send-message", payload);
    setMessages((prev) => [
      ...prev,
      { sender: userId, message: input, createdAt: new Date().toISOString() },
    ]);
    setInput("");
  };

  return (
    <div className="flex flex-col flex-1 bg-white h-full border border-gray-200 rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-gray-300 text-lg sm:text-xl font-semibold text-gray-800 flex items-center justify-between">
        <span>{title}</span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-gray-50">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] sm:max-w-[60%] px-4 py-2 rounded-2xl text-sm sm:text-base break-words shadow-sm ${
              m.sender === userId
                ? "bg-blue-600 text-white ml-auto rounded-tr-none"
                : "bg-gray-200 text-gray-900 rounded-tl-none"
            }`}
          >
            {m.message}
            <div className="text-xs opacity-70 mt-1 text-right">
              {new Date(m.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-gray-300 flex gap-2">
        <input
          type="text"
          className="flex-1 bg-gray-100 border border-gray-300 text-gray-900 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
        >
          Send
        </button>
      </div>
    </div>
  );
}
