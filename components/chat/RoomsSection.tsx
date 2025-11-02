"use client";
import { useState, useEffect } from "react";

interface Room {
  _id: string;
  name: string;
}

interface RoomsSectionProps {
  onSelectRoom: (room: Room) => void;
  selectedRoomId?: string;
}

export default function RoomsSection({
  onSelectRoom,
  selectedRoomId,
}: RoomsSectionProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoom, setNewRoom] = useState("");

  const loadRooms = async () => {
    try {
      const res = await fetch("/api/rooms/get");
      const data = await res.json();
      if (data.ok) setRooms(data.rooms);
    } catch {
      /* ignore */
    }
  };

  const createRoom = async () => {
    if (!newRoom.trim()) return;
    try {
      await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoom }),
      });
      setNewRoom("");
      loadRooms();
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  return (
    <div className="w-full sm:w-64 h-full border-r border-gray-200 bg-white flex flex-col p-3 sm:p-4 shadow-sm">
      {/* Create room section */}
      <div className="flex mb-4">
        <input
          type="text"
          placeholder="New room..."
          className="flex-1 bg-gray-100 border border-gray-300 text-gray-900 text-sm px-3 py-2 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          value={newRoom}
          onChange={(e) => setNewRoom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createRoom()}
        />
        <button
          onClick={createRoom}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-r-lg text-sm font-medium transition-all"
        >
          +
        </button>
      </div>

      {/* Rooms list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {rooms.length === 0 ? (
          <div className="text-gray-500 text-sm text-center mt-10">
            No rooms yet
          </div>
        ) : (
          rooms.map((r) => (
            <div
              key={r._id}
              onClick={() => onSelectRoom(r)}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selectedRoomId === r._id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-800"
              }`}
            >
              {r.name}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
