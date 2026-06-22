import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createSession, getSessionCookieName, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; name?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const password = body.password ?? "";

  if (!email || !name || password.length < 6) {
    return NextResponse.json({ error: "이름, 이메일, 비밀번호(6자 이상)를 입력해 주세요." }, { status: 400 });
  }

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;
  if (exists) {
    return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const created = db
    .prepare("INSERT INTO users (email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?)")
    .run(email, name, passwordHash, now);

  const userId = Number(created.lastInsertRowid);
  const session = createSession(userId);

  const res = NextResponse.json({ ok: true, user: { id: userId, email, name } });
  res.cookies.set(getSessionCookieName(), session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });

  return res;
}
