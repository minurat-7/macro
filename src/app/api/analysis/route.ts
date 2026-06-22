import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAnalysis, upsertAnalysis } from "@/lib/service";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const passageId = Number(searchParams.get("passageId"));
  if (!passageId) {
    return NextResponse.json({ error: "passageId가 필요합니다." }, { status: 400 });
  }

  return NextResponse.json(getAnalysis(user.id, passageId));
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await req.json()) as {
    passageId?: number;
    memo?: string;
    mainIdea?: string;
    evidence?: string;
    wrongReason?: string;
    nextFocus?: string;
  };

  if (!body.passageId) {
    return NextResponse.json({ error: "passageId가 필요합니다." }, { status: 400 });
  }

  return NextResponse.json(
    upsertAnalysis(user.id, body.passageId, {
      memo: body.memo,
      mainIdea: body.mainIdea,
      evidence: body.evidence,
      wrongReason: body.wrongReason,
      nextFocus: body.nextFocus,
    }),
  );
}
