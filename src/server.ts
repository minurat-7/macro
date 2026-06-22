import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { AppStore, gradeAnswers } from './store.js';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    userName?: string;
    csrfToken?: string;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const dataDir = path.resolve(__dirname, '../data');
fs.mkdirSync(dataDir, { recursive: true });
const store = new AppStore(path.join(dataDir, 'app.db'));
const MAX_TIME_SECONDS = 60 * 60 * 3;
const MAX_TEXT_LENGTH = 2000;
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production');
}

app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 14
    }
  })
);
app.use((req, _res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  next();
});
app.use((req, res, next) => {
  if (req.method === 'POST') {
    const token = String(req.body._csrf ?? '');
    if (!token || token !== req.session.csrfToken) {
      res.status(403).send(page('오류', '<p>유효하지 않은 요청입니다.</p><a href=\"/\">돌아가기</a>'));
      return;
    }
  }
  next();
});

function escapeHtml(v: string) {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function csrfInput(req: express.Request) {
  return `<input type="hidden" name="_csrf" value="${req.session.csrfToken ?? ''}" />`;
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session.userId) {
    res.redirect('/');
    return;
  }
  next();
}

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #f5f7fb; color: #111; }
    .wrap { max-width: 900px; margin: 0 auto; padding: 16px; }
    .card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); margin-bottom: 14px; }
    input, textarea { width: 100%; box-sizing: border-box; padding: 10px; margin: 6px 0 10px; border: 1px solid #d6dbe4; border-radius: 8px; }
    button { border: 0; background: #2f6bff; color: white; padding: 10px 14px; border-radius: 8px; cursor: pointer; }
    .muted { color: #666; font-size: 14px; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; }
    .ok { color: #0f8a3b; font-weight: 600; }
    .no { color: #d64545; font-weight: 600; }
    a { color: #2f6bff; text-decoration: none; }
  </style>
</head>
<body><div class="wrap">${body}</div></body></html>`;
}

app.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/home');
    return;
  }
  res.send(
    page(
      '1일 1비문학 챌린지',
      `<h1>1일 1비문학 챌린지</h1>
       <div class="row">
         <div class="card" style="flex:1;min-width:260px;">
           <h3>회원가입</h3>
           <form method="post" action="/auth/signup">
             ${csrfInput(req)}
             <label>이름</label><input name="name" required maxlength="30" />
             <label>이메일</label><input name="email" type="email" required />
             <label>비밀번호</label><input name="password" type="password" minlength="6" required />
             <button type="submit">가입하기</button>
           </form>
         </div>
         <div class="card" style="flex:1;min-width:260px;">
           <h3>로그인</h3>
           <form method="post" action="/auth/login">
             ${csrfInput(req)}
             <label>이메일</label><input name="email" type="email" required />
             <label>비밀번호</label><input name="password" type="password" required />
             <button type="submit">로그인</button>
           </form>
         </div>
       </div>`
    )
  );
});

app.post('/auth/signup', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');
  if (!name || !email || password.length < 6) {
    res.status(400).send(page('오류', '<p>입력값이 올바르지 않습니다.</p><a href="/">돌아가기</a>'));
    return;
  }
  if (store.findUserByEmail(email)) {
    res.status(409).send(page('오류', '<p>이미 존재하는 이메일입니다.</p><a href="/">돌아가기</a>'));
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = store.createUser(email, name, passwordHash);
  req.session.userId = userId;
  req.session.userName = name;
  res.redirect('/home');
});

app.post('/auth/login', async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');
  const user = store.findUserByEmail(email);
  if (!user) {
    res.status(401).send(page('오류', '<p>이메일 또는 비밀번호가 올바르지 않습니다.</p><a href="/">돌아가기</a>'));
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).send(page('오류', '<p>이메일 또는 비밀번호가 올바르지 않습니다.</p><a href="/">돌아가기</a>'));
    return;
  }
  req.session.userId = user.id;
  req.session.userName = user.name;
  res.redirect('/home');
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/home', requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const daily = store.getDailyResult(userId, today());
  const records = store.getRecords(userId);

  res.send(
    page(
      '홈',
      `<div class="row" style="justify-content:space-between;align-items:center;">
         <h1>안녕하세요, ${escapeHtml(req.session.userName ?? '사용자')}님</h1>
         <form method="post" action="/auth/logout">${csrfInput(req)}<button type="submit">로그아웃</button></form>
       </div>
       <div class="card">
         <h2>오늘의 지문 (${daily.assignment.assignedDate})</h2>
         <p><strong>${escapeHtml(daily.passage.title)}</strong> · ${daily.passage.sourceYear} ${escapeHtml(daily.passage.sourceExamType)}</p>
         <p class="muted">상태: ${daily.assignment.isCompleted ? '풀이 완료' : '미완료'}</p>
         <div class="row">
           <a href="/solve">풀이하기</a>
           <a href="/result">결과보기</a>
           <a href="/analysis">분석노트</a>
           <a href="/records">학습기록</a>
         </div>
       </div>
       <div class="card">
         <h3>학습 현황</h3>
         <p>연속 학습: <strong>${records.streakCount}일</strong> · 누적 완료: <strong>${records.totalCompleted}일</strong> · 정확도: <strong>${records.accuracy}%</strong></p>
       </div>`
    )
  );
});

app.get('/solve', requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const daily = store.getDailyResult(userId, today());
  if (daily.assignment.isCompleted) {
    res.redirect('/result');
    return;
  }

  const questionHtml = daily.questions
    .map(
      (q, idx) => `<div class="card"><h3>문항 ${idx + 1}</h3><p>${escapeHtml(q.questionText)}</p>${q.choices
        .map(
          (c, i) => `<label style="display:block;margin-bottom:6px;">
            <input type="radio" name="q_${q.id}" value="${i}" required /> ${escapeHtml(c)}
          </label>`
        )
        .join('')}</div>`
    )
    .join('');

  res.send(
    page(
      '풀이',
      `<h1>${escapeHtml(daily.passage.title)}</h1>
       <div class="card"><p style="line-height:1.8;white-space:pre-wrap;">${escapeHtml(daily.passage.content)}</p></div>
       <form method="post" action="/solve">
         ${csrfInput(req)}
         <input type="hidden" name="startedAt" value="${Date.now()}" />
         ${questionHtml}
         <button type="submit">제출하기</button>
       </form>`
    )
  );
});

app.post('/solve', requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const daily = store.getDailyResult(userId, today());
  const answers = new Map<number, number>();

  for (const q of daily.questions) {
    const raw = req.body[`q_${q.id}`];
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0 || n >= q.choices.length) {
      res.status(400).send(page('오류', '<p>응답 형식이 올바르지 않습니다.</p><a href="/solve">다시 시도</a>'));
      return;
    }
    answers.set(q.id, n);
  }

  const startedAt = Number(req.body.startedAt);
  const elapsed = Number.isFinite(startedAt) ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const timeSpent = Math.max(0, Math.min(MAX_TIME_SECONDS, elapsed));

  const graded = gradeAnswers(daily.questions, answers);
  store.submitAnswers(userId, daily.assignment.id, graded, timeSpent);
  res.redirect('/result');
});

app.get('/result', requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const daily = store.getDailyResult(userId, today());
  const responses = store.getResponses(daily.assignment.id);
  const responseByQuestion = new Map(responses.map((r) => [r.questionId, r]));

  const solved = responses.length > 0;
  const correctCount = responses.filter((r) => r.isCorrect === 1).length;

  const details = daily.questions
    .map((q, idx) => {
      const response = responseByQuestion.get(q.id);
      if (!response) {
        return `<div class="card"><h3>문항 ${idx + 1}</h3><p>아직 제출하지 않았습니다.</p></div>`;
      }
      return `<div class="card">
        <h3>문항 ${idx + 1}</h3>
        <p>${escapeHtml(q.questionText)}</p>
        <p>내 답: ${escapeHtml(q.choices[response.selectedIndex] ?? '미선택')}</p>
        <p class="${response.isCorrect ? 'ok' : 'no'}">${response.isCorrect ? '정답' : '오답'}</p>
        <p class="muted">해설: ${escapeHtml(q.explanation)}</p>
      </div>`;
    })
    .join('');

  res.send(
    page(
      '결과',
      `<h1>오늘의 결과</h1>
       <div class="card">
        <p>진행 상태: ${solved ? '제출 완료' : '미제출'}</p>
        <p>정답 수: ${correctCount}/${daily.questions.length}</p>
        <div class="row"><a href="/analysis">분석노트 작성</a><a href="/records">학습기록 보기</a></div>
       </div>
       ${details}`
    )
  );
});

app.get('/analysis', requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const daily = store.getDailyResult(userId, today());
  const analysis = store.getAnalysis(userId, daily.passage.id);
  const value = (v: string | undefined) => escapeHtml(v ?? '');

  res.send(
    page(
      '분석노트',
      `<h1>분석노트</h1>
       <div class="card">
         <p><strong>${escapeHtml(daily.passage.title)}</strong></p>
         <form method="post" action="/analysis">
           ${csrfInput(req)}
           <label>메모</label><textarea name="memo" rows="4">${value(analysis?.memo)}</textarea>
           <label>핵심 주장</label><input name="mainIdea" value="${value(analysis?.mainIdea)}" />
           <label>근거 문장</label><textarea name="evidence" rows="3">${value(analysis?.evidence)}</textarea>
           <label>틀린 이유</label><textarea name="wrongReason" rows="3">${value(analysis?.wrongReason)}</textarea>
           <label>다음 집중 포인트</label><textarea name="nextFocus" rows="3">${value(analysis?.nextFocus)}</textarea>
           <button type="submit">저장</button>
         </form>
         ${analysis ? `<p class="muted">마지막 수정: ${escapeHtml(analysis.updatedAt)}</p>` : ''}
       </div>
       <a href="/home">홈으로</a>`
    )
  );
});

app.post('/analysis', requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const daily = store.getDailyResult(userId, today());
  const toText = (v: unknown) => String(v ?? '').slice(0, MAX_TEXT_LENGTH);
  store.upsertAnalysis(userId, daily.passage.id, {
    memo: toText(req.body.memo),
    mainIdea: toText(req.body.mainIdea),
    evidence: toText(req.body.evidence),
    wrongReason: toText(req.body.wrongReason),
    nextFocus: toText(req.body.nextFocus)
  });
  res.redirect('/analysis');
});

app.get('/records', requireAuth, (req, res) => {
  const userId = req.session.userId!;
  const records = store.getRecords(userId);
  const rows = records.rows
    .map(
      (r) => `<tr><td>${r.assignedDate}</td><td>${r.isCompleted ? '완료' : '미완료'}</td><td>${r.correctCount}/${r.totalCount}</td></tr>`
    )
    .join('');

  res.send(
    page(
      '학습기록',
      `<h1>학습기록</h1>
       <div class="card">
         <p>연속 학습: <strong>${records.streakCount}일</strong></p>
         <p>총 완료: <strong>${records.totalCompleted}일</strong></p>
         <p>총 정답 수: <strong>${records.totalCorrect}</strong></p>
         <p>정확도: <strong>${records.accuracy}%</strong></p>
       </div>
       <div class="card">
         <h3>날짜별 완료 현황</h3>
         <table style="width:100%;border-collapse:collapse;"><thead><tr><th align="left">날짜</th><th align="left">상태</th><th align="left">정답</th></tr></thead><tbody>${rows || '<tr><td colspan="3">기록 없음</td></tr>'}</tbody></table>
       </div>
       <a href="/home">홈으로</a>`
    )
  );
});

const port = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;
