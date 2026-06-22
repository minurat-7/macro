import db from "@/lib/db";

export type PublicQuestion = {
  id: number;
  questionText: string;
  choices: string[];
};

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getTodayDateKey() {
  return dateFormatter.format(new Date());
}

export function getOrCreateDailyAssignment(userId: number) {
  const today = getTodayDateKey();

  const existing = db
    .prepare("SELECT * FROM dailyAssignments WHERE userId = ? AND assignedDate = ?")
    .get(userId, today) as
    | {
        id: number;
        userId: number;
        passageId: number;
        assignedDate: string;
        isCompleted: number;
      }
    | undefined;

  if (existing) {
    return existing;
  }

  const passage = db
    .prepare(
      `SELECT p.id
       FROM passages p
       LEFT JOIN dailyAssignments d ON d.passageId = p.id
       GROUP BY p.id
       ORDER BY COUNT(d.id) ASC, p.id ASC
       LIMIT 1`,
    )
    .get() as { id: number };

  const now = new Date().toISOString();
  const result = db
    .prepare(
      "INSERT INTO dailyAssignments (userId, passageId, assignedDate, isCompleted, createdAt) VALUES (?, ?, ?, 0, ?)",
    )
    .run(userId, passage.id, today, now);

  return {
    id: Number(result.lastInsertRowid),
    userId,
    passageId: passage.id,
    assignedDate: today,
    isCompleted: 0,
  };
}

export function getAssignmentPayload(userId: number) {
  const assignment = getOrCreateDailyAssignment(userId);

  const passage = db
    .prepare("SELECT id, title, sourceYear, sourceExamType, difficulty, content FROM passages WHERE id = ?")
    .get(assignment.passageId) as {
    id: number;
    title: string;
    sourceYear: number;
    sourceExamType: string;
    difficulty: string;
    content: string;
  };

  const questions = db
    .prepare(
      "SELECT id, questionText, choice1, choice2, choice3, choice4, answerIndex, explanation FROM questions WHERE passageId = ? ORDER BY id",
    )
    .all(assignment.passageId) as Array<{
    id: number;
    questionText: string;
    choice1: string;
    choice2: string;
    choice3: string;
    choice4: string;
    answerIndex: number;
    explanation: string;
  }>;

  const responses = db
    .prepare(
      "SELECT questionId, selectedIndex, isCorrect, timeSpentSeconds FROM userResponses WHERE userId = ? AND dailyAssignmentId = ?",
    )
    .all(userId, assignment.id) as Array<{
    questionId: number;
    selectedIndex: number;
    isCorrect: number;
    timeSpentSeconds: number;
  }>;

  const responseMap = new Map(responses.map((item) => [item.questionId, item]));

  const baseQuestions = questions.map(
    (q): PublicQuestion => ({
      id: q.id,
      questionText: q.questionText,
      choices: [q.choice1, q.choice2, q.choice3, q.choice4],
    }),
  );

  const solved = Number(assignment.isCompleted) === 1;

  return {
    assignment: {
      id: assignment.id,
      assignedDate: assignment.assignedDate,
      isCompleted: solved,
    },
    progress: {
      answeredCount: responses.length,
      totalQuestions: questions.length,
      correctCount: responses.filter((r) => r.isCorrect === 1).length,
    },
    passage,
    questions: solved
      ? questions.map((q) => {
          const user = responseMap.get(q.id);
          return {
            id: q.id,
            questionText: q.questionText,
            choices: [q.choice1, q.choice2, q.choice3, q.choice4],
            selectedIndex: user?.selectedIndex ?? null,
            isCorrect: user?.isCorrect === 1,
            answerIndex: q.answerIndex,
            explanation: q.explanation,
          };
        })
      : baseQuestions,
  };
}

export function submitAnswers(
  userId: number,
  assignmentId: number,
  answers: Array<{ questionId: number; selectedIndex: number }>,
  timeSpentSeconds: number,
) {
  const assignment = db
    .prepare("SELECT id, passageId, userId, isCompleted FROM dailyAssignments WHERE id = ?")
    .get(assignmentId) as { id: number; passageId: number; userId: number; isCompleted: number } | undefined;

  if (!assignment || assignment.userId !== userId) {
    throw new Error("유효하지 않은 과제입니다.");
  }

  if (assignment.isCompleted === 1) {
    return getAssignmentPayload(userId);
  }

  const questions = db
    .prepare("SELECT id, answerIndex, explanation, questionText, choice1, choice2, choice3, choice4 FROM questions WHERE passageId = ?")
    .all(assignment.passageId) as Array<{
    id: number;
    answerIndex: number;
    explanation: string;
    questionText: string;
    choice1: string;
    choice2: string;
    choice3: string;
    choice4: string;
  }>;

  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));
  const perQuestionTime = Math.max(1, Math.floor(timeSpentSeconds / Math.max(1, questions.length)));
  const now = new Date().toISOString();

  const insertResponse = db.prepare(
    "INSERT INTO userResponses (userId, questionId, dailyAssignmentId, selectedIndex, isCorrect, timeSpentSeconds, solvedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  const tx = db.transaction(() => {
    for (const question of questions) {
      const selectedIndex = answerMap.get(question.id);
      if (selectedIndex === undefined) {
        throw new Error("모든 문항에 답변해 주세요.");
      }

      insertResponse.run(
        userId,
        question.id,
        assignmentId,
        selectedIndex,
        selectedIndex === question.answerIndex ? 1 : 0,
        perQuestionTime,
        now,
      );
    }

    db.prepare("UPDATE dailyAssignments SET isCompleted = 1, completedAt = ? WHERE id = ?").run(now, assignmentId);
  });

  tx();

  return getAssignmentPayload(userId);
}

export function getAnalysis(userId: number, passageId: number) {
  const row = db
    .prepare(
      "SELECT memo, mainIdea, evidence, wrongReason, nextFocus, updatedAt FROM userAnalysis WHERE userId = ? AND passageId = ?",
    )
    .get(userId, passageId) as
    | {
        memo: string | null;
        mainIdea: string | null;
        evidence: string | null;
        wrongReason: string | null;
        nextFocus: string | null;
        updatedAt: string;
      }
    | undefined;

  return (
    row ?? {
      memo: "",
      mainIdea: "",
      evidence: "",
      wrongReason: "",
      nextFocus: "",
      updatedAt: null,
    }
  );
}

export function upsertAnalysis(
  userId: number,
  passageId: number,
  payload: { memo?: string; mainIdea?: string; evidence?: string; wrongReason?: string; nextFocus?: string },
) {
  const now = new Date().toISOString();
  const values = {
    memo: payload.memo ?? "",
    mainIdea: payload.mainIdea ?? "",
    evidence: payload.evidence ?? "",
    wrongReason: payload.wrongReason ?? "",
    nextFocus: payload.nextFocus ?? "",
  };

  db.prepare(
    `INSERT INTO userAnalysis (userId, passageId, memo, mainIdea, evidence, wrongReason, nextFocus, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(userId, passageId)
     DO UPDATE SET memo = excluded.memo, mainIdea = excluded.mainIdea, evidence = excluded.evidence,
                   wrongReason = excluded.wrongReason, nextFocus = excluded.nextFocus, updatedAt = excluded.updatedAt`,
  ).run(userId, passageId, values.memo, values.mainIdea, values.evidence, values.wrongReason, values.nextFocus, now);

  return getAnalysis(userId, passageId);
}

export function getRecords(userId: number) {
  const dailyRows = db
    .prepare(
      `SELECT d.assignedDate, d.id as assignmentId
       FROM dailyAssignments d
       WHERE d.userId = ? AND d.isCompleted = 1
       ORDER BY d.assignedDate ASC`,
    )
    .all(userId) as Array<{ assignedDate: string; assignmentId: number }>;

  const summary = db
    .prepare(
      `SELECT COUNT(*) as totalCompleted,
              COALESCE(SUM(CASE WHEN ur.isCorrect = 1 THEN 1 ELSE 0 END), 0) as totalCorrect,
              COALESCE(COUNT(ur.id), 0) as totalSolved
       FROM dailyAssignments d
       LEFT JOIN userResponses ur ON ur.dailyAssignmentId = d.id
       WHERE d.userId = ? AND d.isCompleted = 1`,
    )
    .get(userId) as { totalCompleted: number; totalCorrect: number; totalSolved: number };

  const byDate = db
    .prepare(
      `SELECT d.assignedDate,
              SUM(CASE WHEN ur.isCorrect = 1 THEN 1 ELSE 0 END) as correctCount,
              COUNT(ur.id) as totalCount
       FROM dailyAssignments d
       LEFT JOIN userResponses ur ON ur.dailyAssignmentId = d.id
       WHERE d.userId = ? AND d.isCompleted = 1
       GROUP BY d.assignedDate
       ORDER BY d.assignedDate DESC`,
    )
    .all(userId) as Array<{ assignedDate: string; correctCount: number; totalCount: number }>;

  const completedSet = new Set(dailyRows.map((item) => item.assignedDate));
  let streakCount = 0;
  let cursor = new Date();

  while (true) {
    const key = cursor.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    if (!completedSet.has(key)) {
      break;
    }
    streakCount += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  const accuracy = summary.totalSolved > 0 ? Math.round((summary.totalCorrect / summary.totalSolved) * 1000) / 10 : 0;

  return {
    totalCompleted: summary.totalCompleted,
    totalCorrect: summary.totalCorrect,
    totalSolved: summary.totalSolved,
    accuracy,
    streakCount,
    history: byDate,
  };
}
