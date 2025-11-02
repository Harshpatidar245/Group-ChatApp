import { NextResponse } from "next/server";
import {connectDB}  from "../../../lib/db";
import User from "../../../models/User";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "replace_with_a_long_secret_value";

export async function GET(req: Request) {
  await connectDB();
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.split(";").map(s => s.trim()).find((c) => c.startsWith("token="));
    if (!match) return NextResponse.json({ ok: false, user: null }, { status: 200 });
    const token = match.split("=")[1];
    let payload: any = null;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return NextResponse.json({ ok: false, user: null }, { status: 200 });
    }

    if (!payload?.userId) return NextResponse.json({ ok: false, user: null }, { status: 200 });

    const user = await User.findById(payload.userId).lean();
    if (!user) return NextResponse.json({ ok: false, user: null }, { status: 200 });

    return NextResponse.json({
      ok: true,
      user: {
        id: (user as any)._id,
        name: (user as any).name,
        email: (user as any).email,
        joinedRooms: (user as any).joinedRooms || [],
      },
    });
  } catch (err) {
    console.error("user route error", err);
    return NextResponse.json({ ok: false, user: null }, { status: 500 });
  }
}
