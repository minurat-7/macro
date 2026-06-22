import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { submitAnswers } from "@/lib/service";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json()) as {
    assignmentId?: number;
    answers?: Array<{ questionId: number; selectedIndex: number }>;
    timeSpentSeconds?: number;
  };

  if (!body.assignmentId || !Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ error: "답안을 확인해 주세요." }, { status: 400 });
  }

  try {
    const payload = submitAnswers(user.id, body.assignmentId, body.answers, Math.max(1, body.timeSpentSeconds ?? 1));
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "제출 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
