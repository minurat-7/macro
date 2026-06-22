"use client";

import { useEffect, useState } from "react";

type Records = {
  totalCompleted: number;
  totalCorrect: number;
  totalSolved: number;
  accuracy: number;
  streakCount: number;
  history: Array<{ assignedDate: string; correctCount: number; totalCount: number }>;
};

export default function RecordsPage() {
  const [records, setRecords] = useState<Records | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/records")
      .then(async (res) => {
        if (!res.ok) {
          setError("로그인 후 이용해 주세요.");
          return;
        }
        setRecords((await res.json()) as Records);
      })
      .catch(() => setError("기록을 불러오지 못했습니다."));
  }, []);

  if (error) {
    return <div className="rounded-lg bg-white p-5 text-red-600 shadow-sm">{error}</div>;
  }

  if (!records) {
    return <div className="rounded-lg bg-white p-5 shadow-sm">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-4">
        <StatCard label="연속 학습" value={`${records.streakCount}일`} />
        <StatCard label="완료 일수" value={`${records.totalCompleted}일`} />
        <StatCard label="총 정답" value={`${records.totalCorrect}문항`} />
        <StatCard label="정답률" value={`${records.accuracy}%`} />
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold">날짜별 완료 기록</h1>
        {records.history.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">아직 완료한 학습이 없습니다.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {records.history.map((item) => (
              <li key={item.assignedDate} className="flex items-center justify-between rounded border border-zinc-200 p-2">
                <span className="font-medium">{item.assignedDate}</span>
                <span className="text-sm text-zinc-600">
                  {item.correctCount}/{item.totalCount} 정답
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg bg-white p-4 shadow-sm">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </article>
  );
}
