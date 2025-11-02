import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "../../../../lib/db";
import { signToken } from "../../../../lib/auth";
import User from "../../../../models/User";

export async function POST(req: Request) {
  await connectDB();
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Missing credentials" }, { status: 400 });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
    }

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
    console.error("login error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
