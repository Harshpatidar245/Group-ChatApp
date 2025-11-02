import { NextResponse } from "next/server";

export async function POST() {
  // basically overwrite the cookie with an empty one that expires immediately
  const res = NextResponse.json({ ok: true, message: "Logged out" });
  res.cookies.set("token", "", { path: "/", expires: new Date(0) });
  return res;
}
