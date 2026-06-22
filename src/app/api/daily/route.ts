import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAssignmentPayload } from "@/lib/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const payload = getAssignmentPayload(user.id);
  return NextResponse.json(payload);
}
