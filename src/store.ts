import Database from 'better-sqlite3';

export type PublicQuestion = { id: number; questionText: string; choices: string[] };
export type FullQuestion = PublicQuestion & { answerIndex: number; explanation: string };

export type AssignmentRow = {
  id: number;
  userId: number;
  passageId: number;
  assignedDate: string;
  isCompleted: number;
  completedAt: string | null;
};

export type Passage = {
  id: number;
  title: string;
  sourceYear: number;
  sourceExamType: string;
  content: string;
};

export type DailyResult = {
  assignment: AssignmentRow;
  passage: Passage;
  questions: FullQuestion[];
};

export type GradeResult = {
  questionId: number;
  selectedIndex: number;
  isCorrect: boolean;
};

export class AppStore {
  db: Database.Database;

  constructor(filename: string) {
    this.db = new Database(filename);
    this.db.pragma('journal_mode = WAL');
    this.init();
    this.seedIfNeeded();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS User (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        passwordHash TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS Passage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        sourceYear INTEGER NOT NULL,
        sourceExamType TEXT NOT NULL,
        difficulty TEXT NOT NULL DEFAULT 'medium',
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS Question (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        passageId INTEGER NOT NULL,
        questionText TEXT NOT NULL,
        choicesJson TEXT NOT NULL,
        answerIndex INTEGER NOT NULL,
        explanation TEXT NOT NULL,
        FOREIGN KEY (passageId) REFERENCES Passage(id)
      );

      CREATE TABLE IF NOT EXISTS DailyAssignment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        passageId INTEGER NOT NULL,
        assignedDate TEXT NOT NULL,
        isCompleted INTEGER NOT NULL DEFAULT 0,
        completedAt TEXT,
        UNIQUE (userId, assignedDate),
        FOREIGN KEY (userId) REFERENCES User(id),
        FOREIGN KEY (passageId) REFERENCES Passage(id)
      );

      CREATE TABLE IF NOT EXISTS UserResponse (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        assignmentId INTEGER NOT NULL,
        questionId INTEGER NOT NULL,
        selectedIndex INTEGER NOT NULL,
        isCorrect INTEGER NOT NULL,
        timeSpentSeconds INTEGER NOT NULL,
        solvedAt TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (assignmentId, questionId),
        FOREIGN KEY (userId) REFERENCES User(id),
        FOREIGN KEY (assignmentId) REFERENCES DailyAssignment(id),
        FOREIGN KEY (questionId) REFERENCES Question(id)
      );

      CREATE TABLE IF NOT EXISTS UserAnalysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        passageId INTEGER NOT NULL,
        memo TEXT,
        mainIdea TEXT,
        evidence TEXT,
        wrongReason TEXT,
        nextFocus TEXT,
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (userId, passageId),
        FOREIGN KEY (userId) REFERENCES User(id),
        FOREIGN KEY (passageId) REFERENCES Passage(id)
      );
    `);
  }

  seedIfNeeded() {
    const count = this.db.prepare('SELECT COUNT(*) AS count FROM Passage').get() as { count: number };
    if (count.count > 0) return;

    const insertPassage = this.db.prepare(
      `INSERT INTO Passage (title, sourceYear, sourceExamType, difficulty, content)
       VALUES (?, ?, ?, ?, ?)`
    );
    const passageId = Number(
      insertPassage.run(
        '기술 혁신과 규제의 균형',
        2024,
        '모의고사',
        'medium',
        '신기술은 생산성과 편의를 높이지만, 예기치 못한 사회적 비용을 수반할 수 있다. 따라서 정책 설계는 혁신 유인을 해치지 않으면서도 위험을 관리하는 균형점을 찾아야 한다. 사전 규제와 사후 책임의 조합은 산업별 특성에 따라 달라져야 하며, 규제의 목적은 기술 자체를 막는 것이 아니라 피해를 최소화하는 데 있다.'
      ).lastInsertRowid
    );

    const insertQuestion = this.db.prepare(
      `INSERT INTO Question (passageId, questionText, choicesJson, answerIndex, explanation)
       VALUES (?, ?, ?, ?, ?)`
    );

    insertQuestion.run(
      passageId,
      '윗글의 중심 주장으로 가장 적절한 것은?',
      JSON.stringify([
        '기술 혁신은 사회적 비용이 없으므로 규제가 불필요하다.',
        '규제는 기술 발전을 방해하므로 전면 폐지해야 한다.',
        '혁신 유인과 위험 관리 사이의 균형 있는 정책 설계가 필요하다.',
        '모든 산업에 동일한 사전 규제를 적용해야 한다.'
      ]),
      2,
      '지문은 혁신의 이점과 위험을 함께 언급하며 균형 있는 정책 설계를 강조한다.'
    );

    insertQuestion.run(
      passageId,
      '글의 내용과 일치하는 것은?',
      JSON.stringify([
        '규제의 목적은 기술 자체를 금지하는 것이다.',
        '사전 규제와 사후 책임의 조합은 산업별로 달라질 수 있다.',
        '사회적 비용은 고려 대상이 아니다.',
        '정책은 항상 사후 책임만으로 구성되어야 한다.'
      ]),
      1,
      '지문에서 산업별 특성에 따라 규제 조합이 달라져야 한다고 했다.'
    );
  }

  findUserByEmail(email: string) {
    return this.db.prepare('SELECT * FROM User WHERE email = ?').get(email) as
      | { id: number; email: string; name: string; passwordHash: string }
      | undefined;
  }

  createUser(email: string, name: string, passwordHash: string) {
    const result = this.db
      .prepare('INSERT INTO User (email, name, passwordHash) VALUES (?, ?, ?)')
      .run(email, name, passwordHash);
    return Number(result.lastInsertRowid);
  }

  getOrCreateAssignment(userId: number, date: string): AssignmentRow {
    const existing = this.db
      .prepare('SELECT * FROM DailyAssignment WHERE userId = ? AND assignedDate = ?')
      .get(userId, date) as AssignmentRow | undefined;
    if (existing) return existing;

    const passage = this.db
      .prepare(
        `SELECT p.id FROM Passage p
         ORDER BY ((p.id + ?) % 997), p.id LIMIT 1`
      )
      .get(userId + Number(date.replace(/-/g, ''))) as { id: number };

    const created = this.db
      .prepare('INSERT INTO DailyAssignment (userId, passageId, assignedDate) VALUES (?, ?, ?)')
      .run(userId, passage.id, date);

    return this.db
      .prepare('SELECT * FROM DailyAssignment WHERE id = ?')
      .get(created.lastInsertRowid) as AssignmentRow;
  }

  getDailyResult(userId: number, date: string): DailyResult {
    const assignment = this.getOrCreateAssignment(userId, date);
    const passage = this.db
      .prepare('SELECT id, title, sourceYear, sourceExamType, content FROM Passage WHERE id = ?')
      .get(assignment.passageId) as Passage;
    const questions = this.db
      .prepare('SELECT id, questionText, choicesJson, answerIndex, explanation FROM Question WHERE passageId = ?')
      .all(assignment.passageId)
      .map((q: any) => ({
        id: q.id,
        questionText: q.questionText,
        choices: JSON.parse(q.choicesJson),
        answerIndex: q.answerIndex,
        explanation: q.explanation
      })) as FullQuestion[];

    return { assignment, passage, questions };
  }

  submitAnswers(
    userId: number,
    assignmentId: number,
    graded: GradeResult[],
    timeSpentSeconds: number
  ) {
    const upsert = this.db.prepare(
      `INSERT INTO UserResponse (userId, assignmentId, questionId, selectedIndex, isCorrect, timeSpentSeconds)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (assignmentId, questionId) DO UPDATE SET
         selectedIndex = excluded.selectedIndex,
         isCorrect = excluded.isCorrect,
         timeSpentSeconds = excluded.timeSpentSeconds,
         solvedAt = datetime('now')`
    );

    const tx = this.db.transaction(() => {
      for (const row of graded) {
        upsert.run(userId, assignmentId, row.questionId, row.selectedIndex, row.isCorrect ? 1 : 0, timeSpentSeconds);
      }
      this.db
        .prepare("UPDATE DailyAssignment SET isCompleted = 1, completedAt = datetime('now') WHERE id = ?")
        .run(assignmentId);
    });
    tx();
  }

  getResponses(assignmentId: number) {
    return this.db
      .prepare('SELECT questionId, selectedIndex, isCorrect, timeSpentSeconds FROM UserResponse WHERE assignmentId = ?')
      .all(assignmentId) as {
      questionId: number;
      selectedIndex: number;
      isCorrect: number;
      timeSpentSeconds: number;
    }[];
  }

  upsertAnalysis(
    userId: number,
    passageId: number,
    payload: { memo: string; mainIdea: string; evidence: string; wrongReason: string; nextFocus: string }
  ) {
    this.db
      .prepare(
        `INSERT INTO UserAnalysis (userId, passageId, memo, mainIdea, evidence, wrongReason, nextFocus, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT (userId, passageId) DO UPDATE SET
           memo = excluded.memo,
           mainIdea = excluded.mainIdea,
           evidence = excluded.evidence,
           wrongReason = excluded.wrongReason,
           nextFocus = excluded.nextFocus,
           updatedAt = datetime('now')`
      )
      .run(userId, passageId, payload.memo, payload.mainIdea, payload.evidence, payload.wrongReason, payload.nextFocus);
  }

  getAnalysis(userId: number, passageId: number) {
    return this.db
      .prepare(
        'SELECT memo, mainIdea, evidence, wrongReason, nextFocus, updatedAt FROM UserAnalysis WHERE userId = ? AND passageId = ?'
      )
      .get(userId, passageId) as
      | {
          memo: string;
          mainIdea: string;
          evidence: string;
          wrongReason: string;
          nextFocus: string;
          updatedAt: string;
        }
      | undefined;
  }

  getRecords(userId: number) {
    const rows = this.db
      .prepare(
        `SELECT assignedDate, isCompleted,
                (SELECT COUNT(*) FROM UserResponse ur WHERE ur.assignmentId = da.id AND ur.isCorrect = 1) AS correctCount,
                (SELECT COUNT(*) FROM UserResponse ur WHERE ur.assignmentId = da.id) AS totalCount
         FROM DailyAssignment da
         WHERE userId = ?
         ORDER BY assignedDate DESC`
      )
      .all(userId) as { assignedDate: string; isCompleted: number; correctCount: number; totalCount: number }[];

    const completedDates = rows.filter((r) => r.isCompleted === 1).map((r) => r.assignedDate).sort();
    const totalCompleted = completedDates.length;
    const totalCorrect = rows.reduce((acc, r) => acc + r.correctCount, 0);
    const totalQuestions = rows.reduce((acc, r) => acc + r.totalCount, 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    return {
      rows,
      totalCompleted,
      totalCorrect,
      accuracy,
      streakCount: calculateStreak(completedDates)
    };
  }
}

export function calculateStreak(completedDates: string[]) {
  if (completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cursor.getUTCDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    if (!set.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function gradeAnswers(questions: FullQuestion[], answers: Map<number, number>): GradeResult[] {
  return questions.map((q) => {
    const selectedIndex = answers.get(q.id) ?? -1;
    return {
      questionId: q.id,
      selectedIndex,
      isCorrect: selectedIndex === q.answerIndex
    };
  });
}
