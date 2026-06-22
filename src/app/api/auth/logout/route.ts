import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionCookieName, removeSession } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (token) {
    removeSession(token);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return res;
}
