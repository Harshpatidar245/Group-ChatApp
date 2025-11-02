import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Room from "@/models/Room";

export async function GET() {
  try {
    await connectDB();
    const rooms = await Room.find({}, { name: 1, createdAt: 1 }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ ok: true, rooms });
  } catch (err) {
    console.error("rooms/get error:", err);
    return NextResponse.json({ ok: false, error: "Failed to fetch rooms" }, { status: 500 });
  }
}
