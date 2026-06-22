"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SolvedQuestion = {
  id: number;
  questionText: string;
  choices: string[];
  selectedIndex: number;
  isCorrect: boolean;
  answerIndex: number;
  explanation: string;
};

type DailyData = {
  assignment: { id: number; assignedDate: string; isCompleted: boolean };
  passage: { id: number; title: string };
  progress: { answeredCount: number; totalQuestions: number; correctCount: number };
  questions: SolvedQuestion[];
};

type Analysis = {
  memo: string;
  mainIdea: string;
  evidence: string;
  wrongReason: string;
  nextFocus: string;
};

export default function ResultPage() {
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>({
    memo: "",
    mainIdea: "",
    evidence: "",
    wrongReason: "",
    nextFocus: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/daily")
      .then(async (res) => {
        if (!res.ok) {
          setMessage("로그인 후 이용해 주세요.");
          return;
        }

        const data = (await res.json()) as DailyData;
        if (!data.assignment.isCompleted) {
          setMessage("아직 제출 전입니다. 먼저 풀이를 완료해 주세요.");
          return;
        }

        setDaily(data);
        const analysisRes = await fetch(`/api/analysis?passageId=${data.passage.id}`);
        if (analysisRes.ok) {
          const analysisData = (await analysisRes.json()) as Analysis;
          setAnalysis({
            memo: analysisData.memo ?? "",
            mainIdea: analysisData.mainIdea ?? "",
            evidence: analysisData.evidence ?? "",
            wrongReason: analysisData.wrongReason ?? "",
            nextFocus: analysisData.nextFocus ?? "",
          });
        }
      })
      .catch(() => setMessage("결과를 불러오지 못했습니다."));
  }, []);

  const save = async () => {
    if (!daily) {
      return;
    }

    setMessage("");
    const res = await fetch("/api/analysis", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passageId: daily.passage.id, ...analysis }),
    });

    if (!res.ok) {
      setMessage("분석 저장에 실패했습니다.");
      return;
    }

    setMessage("분석이 저장되었습니다.");
  };

  if (!daily) {
    return (
      <div className="space-y-2 rounded-lg bg-white p-5 shadow-sm">
        <p>{message || "불러오는 중..."}</p>
        {message ? (
          <Link href="/solve" className="text-sm text-blue-600 underline">
            풀이 화면으로 이동
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold">{daily.passage.title}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          오늘 정답: {daily.progress.correctCount}/{daily.progress.totalQuestions}
        </p>
      </section>

      <section className="space-y-3 rounded-lg bg-white p-5 shadow-sm">
        {daily.questions.map((question, index) => (
          <article key={question.id} className="rounded border border-zinc-200 p-3">
            <p className="font-medium">
              {index + 1}. {question.questionText}
            </p>
            <p className="mt-2 text-sm">내 답: {question.selectedIndex + 1}번</p>
            <p className={`text-sm ${question.isCorrect ? "text-emerald-700" : "text-red-600"}`}>
              {question.isCorrect ? "정답" : `오답 (정답: ${question.answerIndex + 1}번)`}
            </p>
            <p className="mt-1 text-sm text-zinc-700">해설: {question.explanation}</p>
          </article>
        ))}
      </section>

      <section className="space-y-2 rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">분석 메모</h2>
        <textarea
          value={analysis.memo}
          onChange={(e) => setAnalysis((prev) => ({ ...prev, memo: e.target.value }))}
          placeholder="자유 메모"
          className="min-h-24 w-full rounded border border-zinc-300 px-3 py-2"
        />
        <input
          value={analysis.mainIdea}
          onChange={(e) => setAnalysis((prev) => ({ ...prev, mainIdea: e.target.value }))}
          placeholder="핵심 주장"
          className="w-full rounded border border-zinc-300 px-3 py-2"
        />
        <input
          value={analysis.evidence}
          onChange={(e) => setAnalysis((prev) => ({ ...prev, evidence: e.target.value }))}
          placeholder="근거 문장"
          className="w-full rounded border border-zinc-300 px-3 py-2"
        />
        <input
          value={analysis.wrongReason}
          onChange={(e) => setAnalysis((prev) => ({ ...prev, wrongReason: e.target.value }))}
          placeholder="틀린 이유"
          className="w-full rounded border border-zinc-300 px-3 py-2"
        />
        <input
          value={analysis.nextFocus}
          onChange={(e) => setAnalysis((prev) => ({ ...prev, nextFocus: e.target.value }))}
          placeholder="다음 포인트"
          className="w-full rounded border border-zinc-300 px-3 py-2"
        />
        <button type="button" onClick={save} className="rounded bg-zinc-900 px-4 py-2 text-white">
          분석 저장
        </button>
        {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
      </section>
    </div>
  );
}
