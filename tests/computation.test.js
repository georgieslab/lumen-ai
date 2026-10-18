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
  assert.equal(evaluateMathExpression('2 ^ 3 ^ 2'), 512);
  assert.equal(evaluateMathExpression('-2 ^ 2'), -4);
  assert.equal(evaluateMathExpression('2 ^ -2'), 0.25);
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

test('zero-rate loans retain the same financial result shape', () => {
  assert.deepEqual(calculateLoanMonthlyPayment(1200, 0, 1), { monthlyPayment: 100, totalPayment: 1200, totalInterest: 0, termMonths: 12 });
  assert.deepEqual(runQuickCompute({ operation: 'loan', loan: { principal: 1200, annualRatePercent: 0, termYears: 1 } }), { success: true, operation: 'loan', monthlyPayment: 100, totalPayment: 1200, totalInterest: 0, termMonths: 12 });
});

test('computation rejects invalid numeric inputs and nonfinite results', () => {
  for (const invalid of [NaN, Infinity, -Infinity, null, '', '5', false]) {
    assert.throws(() => calculateLoanMonthlyPayment(invalid, 5, 1), /finite number/);
    assert.throws(() => calculateCompoundInterest(100, invalid, 1), /finite number/);
    assert.throws(() => calculateStatistics([1, invalid, 3]), /finite number/);
  }
  assert.throws(() => calculateCompoundInterest(100, 5, 10, 0), /Compounding frequency/);
  assert.throws(() => calculateCompoundInterest(100, 1000, 10000), /numeric range/);
  for (const expression of ['sqrt(-1)', 'exp(10000)', '1 % 0', 'min()', 'sqrt(4, 9)']) {
    assert.ok(runQuickCompute({ expression }).error);
  }
  assert.ok(runQuickCompute(null).error);
  assert.ok(runQuickCompute({ operation: 'unsupported', expression: '2+2' }).error);
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

