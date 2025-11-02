import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    const users = await User.find(
      query
        ? { name: { $regex: query, $options: "i" } }
        : {},
      { password: 0 } // exclude sensitive data
    ).limit(20);

    return NextResponse.json({ ok: true, users });
  } catch (err) {
    console.error("Error fetching users:", err);
    return NextResponse.json({ ok: false, error: "Failed to fetch users" }, { status: 500 });
  }
}
