import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "app.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS passages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  sourceYear INTEGER NOT NULL,
  sourceExamType TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  content TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passageId INTEGER NOT NULL,
  questionText TEXT NOT NULL,
  choice1 TEXT NOT NULL,
  choice2 TEXT NOT NULL,
  choice3 TEXT NOT NULL,
  choice4 TEXT NOT NULL,
  answerIndex INTEGER NOT NULL,
  explanation TEXT NOT NULL,
  FOREIGN KEY (passageId) REFERENCES passages(id)
);

CREATE TABLE IF NOT EXISTS dailyAssignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  passageId INTEGER NOT NULL,
  assignedDate TEXT NOT NULL,
  isCompleted INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  completedAt TEXT,
  UNIQUE(userId, assignedDate),
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (passageId) REFERENCES passages(id)
);

CREATE TABLE IF NOT EXISTS userResponses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  questionId INTEGER NOT NULL,
  dailyAssignmentId INTEGER NOT NULL,
  selectedIndex INTEGER NOT NULL,
  isCorrect INTEGER NOT NULL,
  timeSpentSeconds INTEGER NOT NULL,
  solvedAt TEXT NOT NULL,
  UNIQUE(userId, questionId, dailyAssignmentId),
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (questionId) REFERENCES questions(id),
  FOREIGN KEY (dailyAssignmentId) REFERENCES dailyAssignments(id)
);

CREATE TABLE IF NOT EXISTS userAnalysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  passageId INTEGER NOT NULL,
  memo TEXT,
  mainIdea TEXT,
  evidence TEXT,
  wrongReason TEXT,
  nextFocus TEXT,
  updatedAt TEXT NOT NULL,
  UNIQUE(userId, passageId),
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (passageId) REFERENCES passages(id)
);
`);

const passageCount = db.prepare("SELECT COUNT(*) as count FROM passages").get() as { count: number };

if (passageCount.count === 0) {
  const now = new Date().toISOString();
  const insertPassage = db.prepare(
    "INSERT INTO passages (title, sourceYear, sourceExamType, difficulty, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertQuestion = db.prepare(
    "INSERT INTO questions (passageId, questionText, choice1, choice2, choice3, choice4, answerIndex, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  const first = insertPassage.run(
    "디지털 보안과 공개키 암호",
    2024,
    "모의고사",
    "중",
    "공개키 암호 방식은 암호화와 복호화에 서로 다른 키를 사용한다. 사용자는 공개키를 통해 데이터를 암호화하고, 개인키를 가진 수신자만 이를 복호화할 수 있다. 이 구조는 키 전달 과정의 위험을 줄이지만, 계산량이 많아 대량 데이터 처리에는 비효율적일 수 있다.",
    now,
  );

  insertQuestion.run(
    first.lastInsertRowid,
    "윗글의 설명으로 가장 적절한 것은?",
    "공개키와 개인키는 항상 동일하다.",
    "공개키 암호는 대량 데이터 처리에서 일반적으로 더 효율적이다.",
    "공개키로 암호화된 데이터는 개인키로 복호화할 수 있다.",
    "공개키 암호는 키 전달 과정의 위험을 증가시킨다.",
    2,
    "지문은 공개키로 암호화하고 개인키로 복호화한다고 설명한다.",
  );

  insertQuestion.run(
    first.lastInsertRowid,
    "공개키 암호 방식의 한계로 지문이 언급한 것은?",
    "개인키를 생성할 수 없다.",
    "계산량이 많아 대량 데이터 처리에 비효율적일 수 있다.",
    "수신자 인증이 불가능하다.",
    "암호문이 항상 평문보다 길다.",
    1,
    "지문은 공개키 암호의 계산량 문제를 한계로 제시한다.",
  );

  const second = insertPassage.run(
    "플랫폼 경제와 네트워크 효과",
    2023,
    "수능",
    "중상",
    "플랫폼 경제에서는 참여자 수가 늘어날수록 서비스의 가치가 커지는 네트워크 효과가 나타난다. 그러나 네트워크 효과가 강할수록 시장이 소수 플랫폼으로 집중될 가능성이 있으며, 이는 경쟁 제한 문제를 낳을 수 있다.",
    now,
  );

  insertQuestion.run(
    second.lastInsertRowid,
    "네트워크 효과에 대한 이해로 옳은 것은?",
    "참여자가 늘수록 서비스 가치는 감소한다.",
    "플랫폼 참여자 수와 서비스 가치는 무관하다.",
    "네트워크 효과는 시장 집중을 유발할 수 있다.",
    "네트워크 효과는 경쟁을 항상 촉진한다.",
    2,
    "지문은 네트워크 효과로 인해 소수 플랫폼 집중 가능성을 언급한다.",
  );
}

export default db;
