"use client";
import { useState, useEffect } from "react";

interface User {
  _id: string;
  name: string;
  email: string;
}

interface SidebarUsersProps {
  onSelectUser: (user: User) => void;
  selectedUserId?: string;
}

export default function SidebarUsers({
  onSelectUser,
  selectedUserId,
}: SidebarUsersProps) {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadUsers = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/user/get?q=${search}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.ok) setUsers(data.users);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    const delay = setTimeout(loadUsers, 400);
    return () => {
      clearTimeout(delay);
      controller.abort();
    };
  }, [search]);

  return (
    <div className="w-full sm:w-64 h-full border-r border-gray-200 bg-white flex flex-col p-3 sm:p-4 shadow-sm transition-all">
      {/* Search bar */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search users..."
          className="w-full bg-gray-100 border border-gray-300 text-gray-900 text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {loading && (
          <span className="absolute right-3 top-2.5 text-xs text-gray-400 animate-pulse">
            Loading...
          </span>
        )}
      </div>

      {/* Users list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {!loading && users.length === 0 ? (
          <div className="text-gray-500 text-sm text-center mt-10">
            No users found.
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u._id}
              onClick={() => onSelectUser(u)}
              className={`cursor-pointer flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                selectedUserId === u._id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-800"
              }`}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 truncate">{u.name}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
