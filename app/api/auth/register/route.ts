import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db";
import User from "../../../../models/User";

export async function POST(req: Request) {
  await connectDB();
  try {
    const { name, email, password } = await req.json();
    if (!name || !email || !password) {
      return NextResponse.json(
        { ok: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, passwordHash, joinedRooms: [] });
    await user.save();

    const token = signToken({ userId: user._id, name: user.name });
    const res = NextResponse.json({
      ok: true,
      user: { id: user._id, name: user.name, email: user.email },
    });

    const maxAge = 60 * 60 * 24 * 7;
    res.headers.set(
      "Set-Cookie",
      `token=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`
    );
    return res;
  } catch (err) {
    console.error("register error", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
