import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import db from "@/lib/db";

const SESSION_COOKIE = "macro_session";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createSession(userId: number) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  db.prepare("INSERT INTO sessions (userId, token, createdAt, expiresAt) VALUES (?, ?, ?, ?)").run(
    userId,
    token,
    now.toISOString(),
    expires.toISOString(),
  );

  return { token, expiresAt: expires };
}

export function removeSession(token: string) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.userId
       WHERE s.token = ? AND s.expiresAt > ?`,
    )
    .get(token, new Date().toISOString()) as SessionUser | undefined;

  return row ?? null;
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}
