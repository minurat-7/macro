import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createSession, getSessionCookieName, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const user = db
    .prepare("SELECT id, email, name, passwordHash FROM users WHERE email = ?")
    .get(email) as { id: number; email: string; name: string; passwordHash: string } | undefined;

  if (!user) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const session = createSession(user.id);
  const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  res.cookies.set(getSessionCookieName(), session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });

  return res;
}
