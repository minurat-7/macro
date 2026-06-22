import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore, gradeAnswers, type FullQuestion } from './store.js';

test('getOrCreateAssignment reuses same date assignment', () => {
  const store = new AppStore(':memory:');
  const uid = store.createUser('a@test.com', 'a', 'hash');

  const a1 = store.getOrCreateAssignment(uid, '2026-06-21');
  const a2 = store.getOrCreateAssignment(uid, '2026-06-21');

  assert.equal(a1.id, a2.id);
});

test('gradeAnswers marks correctness', () => {
  const questions: FullQuestion[] = [
    { id: 1, questionText: 'q1', choices: ['a', 'b'], answerIndex: 1, explanation: 'e1' },
    { id: 2, questionText: 'q2', choices: ['a', 'b'], answerIndex: 0, explanation: 'e2' }
  ];
  const map = new Map<number, number>([
    [1, 1],
    [2, 1]
  ]);

  const result = gradeAnswers(questions, map);
  assert.deepEqual(result, [
    { questionId: 1, selectedIndex: 1, isCorrect: true },
    { questionId: 2, selectedIndex: 1, isCorrect: false }
  ]);
});
