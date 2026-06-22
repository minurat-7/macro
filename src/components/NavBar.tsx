"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type User = { id: number; name: string; email: string };

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then(async (res) => {
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = (await res.json()) as { user: User };
        setUser(data.user);
      })
      .catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-zinc-900">
          1일 1비문학 챌린지
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/solve" className="text-zinc-700 hover:text-zinc-900">
            풀이
          </Link>
          <Link href="/result" className="text-zinc-700 hover:text-zinc-900">
            결과
          </Link>
          <Link href="/records" className="text-zinc-700 hover:text-zinc-900">
            기록
          </Link>
          {user ? (
            <button
              onClick={logout}
              className="rounded border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-100"
              type="button"
            >
              {user.name} 로그아웃
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
