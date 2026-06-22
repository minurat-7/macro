"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Question = { id: number; questionText: string; choices: string[] };
type DailyData = {
  assignment: { id: number; assignedDate: string; isCompleted: boolean };
  passage: { id: number; title: string; sourceYear: number; sourceExamType: string; content: string };
  questions: Question[];
};

export default function SolvePage() {
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [startedAt] = useState(() => Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/daily")
      .then(async (res) => {
        if (!res.ok) {
          setError("로그인 후 이용해 주세요.");
          return;
        }
        setDaily((await res.json()) as DailyData);
      })
      .catch(() => setError("오늘 과제를 불러오지 못했습니다."));
  }, []);

  const allAnswered = useMemo(
    () => !!daily && daily.questions.every((question) => answers[question.id] !== undefined),
    [daily, answers],
  );

  const submit = async () => {
    if (!daily) {
      return;
    }

    setError("");
    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const payload = {
      assignmentId: daily.assignment.id,
      timeSpentSeconds,
      answers: daily.questions.map((question) => ({
        questionId: question.id,
        selectedIndex: answers[question.id],
      })),
    };

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "제출에 실패했습니다.");
      return;
    }

    window.location.href = "/result";
  };

  if (error) {
    return (
      <div className="space-y-2 rounded-lg bg-white p-5 shadow-sm">
        <p className="text-red-600">{error}</p>
        <Link href="/" className="text-sm text-blue-600 underline">
          홈으로 이동
        </Link>
      </div>
    );
  }

  if (!daily) {
    return <div className="rounded-lg bg-white p-5 shadow-sm">불러오는 중...</div>;
  }

  if (daily.assignment.isCompleted) {
    return (
      <div className="space-y-2 rounded-lg bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold">오늘 문제를 이미 제출했습니다.</h1>
        <Link href="/result" className="text-blue-600 underline">
          결과/해설 보러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold">{daily.passage.title}</h1>
        <p className="mt-1 text-xs text-zinc-500">
          {daily.passage.sourceYear} {daily.passage.sourceExamType}
        </p>
        <p className="mt-4 whitespace-pre-line leading-7 text-zinc-800">{daily.passage.content}</p>
      </section>

      <section className="space-y-3 rounded-lg bg-white p-5 shadow-sm">
        {daily.questions.map((question, index) => (
          <article key={question.id} className="rounded border border-zinc-200 p-3">
            <p className="font-medium">
              {index + 1}. {question.questionText}
            </p>
            <div className="mt-2 space-y-2">
              {question.choices.map((choice, choiceIndex) => (
                <label key={choice} className="flex cursor-pointer gap-2 text-sm">
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    checked={answers[question.id] === choiceIndex}
                    onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: choiceIndex }))}
                  />
                  <span>
                    {choiceIndex + 1}. {choice}
                  </span>
                </label>
              ))}
            </div>
          </article>
        ))}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={!allAnswered}
          className="rounded bg-zinc-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          제출하기
        </button>
      </section>
    </div>
  );
}
