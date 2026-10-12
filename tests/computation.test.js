import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMathExpression,
  calculateLoanMonthlyPayment,
  calculateCompoundInterest,
  calculateStatistics,
  runQuickCompute
} from '../services/computation.js';

test('evaluateMathExpression parses standard arithmetic and operator precedence', () => {
  assert.equal(evaluateMathExpression('2 + 3 * 4'), 14);
  assert.equal(evaluateMathExpression('(2 + 3) * 4'), 20);
  assert.equal(evaluateMathExpression('10 / 2 + 3'), 8);
  assert.equal(evaluateMathExpression('2 ^ 3'), 8);
  assert.equal(evaluateMathExpression('10 % 3'), 1);
});

test('evaluateMathExpression handles unary negative and nested parentheses', () => {
  assert.equal(evaluateMathExpression('-5 + 10'), 5);
  assert.equal(evaluateMathExpression('-(5 + 10) * 2'), -30);
});

test('evaluateMathExpression handles math functions and constants', () => {
  assert.equal(evaluateMathExpression('sqrt(16) + abs(-5)'), 9);
  assert.equal(evaluateMathExpression('round(4.6)'), 5);
  assert.equal(evaluateMathExpression('max(10, 25, 5)'), 25);
  assert.equal(evaluateMathExpression('min(10, 25, 5)'), 5);
  assert.ok(Math.abs(evaluateMathExpression('PI * 2') - Math.PI * 2) < 0.0001);
});

test('evaluateMathExpression rejects invalid characters or malformed input', () => {
  assert.throws(() => evaluateMathExpression(''), /Empty expression/);
  assert.throws(() => evaluateMathExpression('process.exit()'), /Unsupported character/);
  assert.throws(() => evaluateMathExpression('10 / 0'), /Division by zero/);
});

test('calculateLoanMonthlyPayment computes valid amortization figures', () => {
  const result = calculateLoanMonthlyPayment(300000, 6.5, 30);
  assert.ok(result.monthlyPayment > 1800 && result.monthlyPayment < 2000);
  assert.equal(result.termMonths, 360);
});

test('calculateCompoundInterest calculates expected growth', () => {
  const result = calculateCompoundInterest(10000, 5, 10, 1);
  assert.ok(result.futureValue > 16000 && result.futureValue < 17000);
  assert.ok(result.interestEarned > 6000);
});

test('calculateStatistics computes mean, median, min, max, sum', () => {
  const stats = calculateStatistics([10, 20, 30, 40, 50]);
  assert.equal(stats.sum, 150);
  assert.equal(stats.average, 30);
  assert.equal(stats.median, 30);
  assert.equal(stats.min, 10);
  assert.equal(stats.max, 50);
});

test('runQuickCompute wraps operations cleanly', () => {
  const r1 = runQuickCompute({ expression: '150 * 1.08 + 25' });
  assert.equal(r1.success, true);
  assert.equal(r1.result, 187);

  const r2 = runQuickCompute({ operation: 'stats', numbers: [1, 2, 3] });
  assert.equal(r2.success, true);
  assert.equal(r2.average, 2);

  const rErr = runQuickCompute({ expression: 'invalid syntax (' });
  assert.equal(rErr.error !== undefined, true);
});

