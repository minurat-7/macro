"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type User = { id: number; email: string; name: string };
type DailyData = {
  assignment: { id: number; assignedDate: string; isCompleted: boolean };
  passage: { title: string };
  progress: { answeredCount: number; totalQuestions: number; correctCount: number };
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [mode, setMode] = useState<"login" | "signup">("login");

  const load = async () => {
    const meRes = await fetch("/api/me");
    if (!meRes.ok) {
      setUser(null);
      setDaily(null);
      return;
    }

    const me = (await meRes.json()) as { user: User };
    setUser(me.user);

    const dailyRes = await fetch("/api/daily");
    if (!dailyRes.ok) {
      setDaily(null);
      return;
    }
    setDaily((await dailyRes.json()) as DailyData);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch(() => setError("데이터를 불러오지 못했습니다."));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const payload = mode === "login" ? { email: form.email, password: form.password } : form;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "요청에 실패했습니다.");
      return;
    }

    setForm({ email: "", password: "", name: "" });
    await load();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">오늘도 1지문 완료하기</h1>
        <p className="mt-2 text-sm text-zinc-600">수능/모의고사 비문학을 매일 한 지문씩 풀고 분석하세요.</p>
      </section>

      {!user ? (
        <section className="rounded-lg bg-white p-5 shadow-sm">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded px-3 py-1 ${mode === "login" ? "bg-zinc-900 text-white" : "bg-zinc-200"}`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded px-3 py-1 ${mode === "signup" ? "bg-zinc-900 text-white" : "bg-zinc-200"}`}
            >
              회원가입
            </button>
          </div>
          <form className="space-y-3" onSubmit={submitAuth}>
            {mode === "signup" ? (
              <input
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="이름"
                className="w-full rounded border border-zinc-300 px-3 py-2"
              />
            ) : null}
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="이메일"
              className="w-full rounded border border-zinc-300 px-3 py-2"
            />
            <input
              required
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="비밀번호(6자 이상)"
              className="w-full rounded border border-zinc-300 px-3 py-2"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button className="rounded bg-zinc-900 px-4 py-2 text-white" type="submit">
              {mode === "login" ? "로그인" : "가입하고 시작"}
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-lg bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-600">{user.name}님, 오늘의 학습 상태</p>
          {daily ? (
            <div className="mt-2 space-y-2">
              <p className="text-lg font-semibold">{daily.passage.title}</p>
              <p className="text-sm text-zinc-700">
                진행률: {daily.progress.answeredCount}/{daily.progress.totalQuestions} · 정답 {daily.progress.correctCount}
              </p>
              <div className="flex gap-2">
                <Link href="/solve" className="rounded bg-zinc-900 px-3 py-2 text-sm text-white">
                  {daily.assignment.isCompleted ? "오늘 풀이 다시 보기" : "오늘 풀이 시작"}
                </Link>
                <Link href="/records" className="rounded border border-zinc-300 px-3 py-2 text-sm">
                  학습 기록 보기
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">오늘 과제를 불러오는 중입니다.</p>
          )}
        </section>
      )}
    </div>
  );
}
