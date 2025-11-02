import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "replace_with_a_long_secret_value";

export async function POST(req: Request) {
  await connectDB();
  try {
    const body = await req.json();
    const { room } = body || {};
    if (!room) return NextResponse.json({ ok: false, error: "Missing room" }, { status: 400 });

    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.split(";").map(s => s.trim()).find((c) => c.startsWith("token="));
    if (!match) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    const token = match.split("=")[1];

    let payload: any = null;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const userId = payload.userId;
    if (!userId) return NextResponse.json({ ok: false, error: "Invalid token payload" }, { status: 401 });

    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    if (!user.joinedRooms) user.joinedRooms = [];
    if (!user.joinedRooms.includes(room)) {
      user.joinedRooms.push(room);
      await user.save();
    }

    return NextResponse.json({ ok: true, joinedRooms: user.joinedRooms });
  } catch (err) {
    console.error("rooms/join error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
