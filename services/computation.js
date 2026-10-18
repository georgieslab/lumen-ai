// Safe computation engine for Lumen AI Agent
// Handles arithmetic, financial formulas, statistical summaries, date differences, and conversions.
// No eval() or Function constructor is used.

// Allowed math operators and functions
const MATH_CONSTANTS = {
  PI: Math.PI,
  E: Math.E
};

const MATH_FUNCTIONS = {
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  log: Math.log,
  log10: Math.log10,
  exp: Math.exp,
  min: Math.min,
  max: Math.max,
  pow: Math.pow
};

export const COMPUTATION_LIMITS = { maxExpressionChars: 2000, maxNumbers: 1000 };

function finiteNumber(value, name, minimum = -Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new Error(`${name} must be a finite number${Number.isFinite(minimum) ? ` greater than or equal to ${minimum}` : ''}`);
  }
  return value;
}

function rounded(value, precision = 2) {
  if (!Number.isFinite(value)) throw new Error('Calculation exceeds the supported numeric range');
  const factor = 10 ** precision;
  const result = Math.abs(value) <= Number.MAX_VALUE / factor ? Math.round(value * factor) / factor : value;
  return Object.is(result, -0) ? 0 : result;
}

// Safe recursive descent arithmetic expression evaluator
export function evaluateMathExpression(expr) {
  if (typeof expr !== 'string') throw new TypeError('Expression must be a string');
  const cleaned = expr.trim();
  if (!cleaned) throw new Error('Empty expression');
  if (cleaned.length > COMPUTATION_LIMITS.maxExpressionChars) throw new Error('Expression is too long');

  // Tokenize
  const tokens = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < cleaned.length && /[0-9]/.test(cleaned[i + 1]))) {
      let numStr = '';
      while (i < cleaned.length && /[0-9.]/.test(cleaned[i])) {
        numStr += cleaned[i];
        i++;
      }
      const num = Number(numStr);
      if (!Number.isFinite(num)) throw new Error(`Invalid number: ${numStr}`);
      tokens.push({ type: 'number', value: num });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < cleaned.length && /[a-zA-Z0-9_]/.test(cleaned[i])) {
        ident += cleaned[i];
        i++;
      }
      tokens.push({ type: 'ident', value: ident });
      continue;
    }

    if (['+', '-', '*', '/', '%', '^', '(', ')', ','].includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    throw new Error(`Unsupported character in expression: ${ch}`);
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpression() {
    let left = parseTerm();
    while (peek() && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm() {
    let left = parseFactor();
    while (peek() && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
      const op = consume().value;
      const right = parseFactor();
      if ((op === '/' || op === '%') && right === 0) throw new Error('Division by zero');
      left = op === '*' ? left * right : op === '/' ? left / right : left % right;
    }
    return left;
  }

  function parseFactor() {
    if (peek()?.type === 'op' && ['+', '-'].includes(peek().value)) {
      const sign = consume().value;
      const value = parseFactor();
      return sign === '-' ? -value : value;
    }
    const left = parsePower();
    if (peek()?.value !== '^') return left;
    consume();
    // Exponentiation associates to the right and binds more tightly than unary minus.
    return Math.pow(left, parseFactor());
  }

  function parsePower() {
    const token = peek();
    if (!token) throw new Error('Unexpected end of expression');

    if (token.type === 'number') {
      consume();
      return token.value;
    }

    if (token.type === 'ident') {
      const name = consume().value;
      if (MATH_CONSTANTS[name] !== undefined) {
        return MATH_CONSTANTS[name];
      }
      if (peek() && peek().value === '(') {
        consume(); // '('
        const args = [];
        if (peek() && peek().value !== ')') {
          args.push(parseExpression());
          while (peek() && peek().value === ',') {
            consume(); // ','
            args.push(parseExpression());
          }
        }
        if (!peek() || peek().value !== ')') {
          throw new Error(`Missing closing parenthesis for function ${name}`);
        }
        consume(); // ')'
        const fn = MATH_FUNCTIONS[name];
        if (!fn) throw new Error(`Unknown function: ${name}`);
        const expected = name === 'pow' ? 2 : ['min', 'max'].includes(name) ? null : 1;
        if ((expected !== null && args.length !== expected) || (expected === null && args.length === 0)) {
          throw new Error(`Function ${name} requires ${expected ?? 'at least one'} argument${expected === 1 ? '' : 's'}`);
        }
        return fn(...args);
      }
      throw new Error(`Unknown variable or constant: ${name}`);
    }

    if (token.type === 'op' && token.value === '(') {
      consume();
      const val = parseExpression();
      if (!peek() || peek().value !== ')') {
        throw new Error('Mismatched parenthesis: missing )');
      }
      consume();
      return val;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token.value)}`);
  }

  const result = parseExpression();
  if (pos < tokens.length) {
    throw new Error(`Unexpected token remaining: ${JSON.stringify(peek().value)}`);
  }
  if (!Number.isFinite(result)) throw new Error('Expression result must be a finite number');
  return result;
}

// Financial calculations (loan payment, compound interest)
export function calculateLoanMonthlyPayment(principal, annualRatePercent, termYears) {
  const p = finiteNumber(principal, 'Principal', 0);
  const rAnnual = finiteNumber(annualRatePercent, 'Annual rate', 0) / 100;
  const nMonths = finiteNumber(termYears, 'Term years', 0) * 12;
  if (p === 0 || nMonths === 0 || !Number.isFinite(nMonths)) throw new Error('Principal and term must be positive finite numbers');
  const rMonthly = rAnnual / 12;
  const monthly = rMonthly === 0 ? p / nMonths : (p * rMonthly) / -Math.expm1(-nMonths * Math.log1p(rMonthly));
  const totalPaid = monthly * nMonths;
  const totalInterest = totalPaid - p;
  return {
    monthlyPayment: rounded(monthly),
    totalPayment: rounded(totalPaid),
    totalInterest: rounded(totalInterest),
    termMonths: nMonths
  };
}

export function calculateCompoundInterest(principal, annualRatePercent, years, compoundTimesPerYear = 1) {
  const p = finiteNumber(principal, 'Principal', 0);
  const r = finiteNumber(annualRatePercent, 'Annual rate', 0) / 100;
  const t = finiteNumber(years, 'Years', 0);
  const n = finiteNumber(compoundTimesPerYear, 'Compounding frequency', 1);
  if (!Number.isInteger(n)) throw new Error('Compounding frequency must be a positive integer');
  const amount = p * Math.pow(1 + r / n, n * t);
  return {
    futureValue: rounded(amount),
    interestEarned: rounded(amount - p),
    initialPrincipal: p
  };
}

// Statistical metrics on arrays of numbers
export function calculateStatistics(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) throw new Error('Array of numbers required');
  if (numbers.length > COMPUTATION_LIMITS.maxNumbers) throw new Error('Too many numbers');
  const valid = numbers.map((value, index) => finiteNumber(value, `numbers[${index}]`));
  const sorted = [...valid].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : sorted[mid - 1] / 2 + sorted[mid] / 2;
  return {
    count: sorted.length,
    sum: rounded(sum),
    average: rounded(avg),
    median: rounded(median),
    min,
    max
  };
}

// Unified agent tool handler
export function runQuickCompute(input = {}) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Computation input must be an object');
    const { operation = 'evaluate', expression, numbers, loan, compound } = input;
    if (operation === 'evaluate') {
      if (typeof expression !== 'string') throw new Error('Expression must be a string');
      const expr = expression.trim();
      if (!expr) return { error: 'No expression provided to evaluate.' };
      const val = evaluateMathExpression(expr);
      return {
        success: true,
        operation: 'evaluate',
        expression: expr,
        result: rounded(val, 4),
        formatted: typeof val === 'number' ? val.toLocaleString('en-US', { maximumFractionDigits: 4 }) : String(val)
      };
    }

    if (operation === 'loan' && loan) {
      const res = calculateLoanMonthlyPayment(loan.principal, loan.annualRatePercent, loan.termYears);
      return { success: true, operation: 'loan', ...res };
    }

    if (operation === 'compound' && compound) {
      const res = calculateCompoundInterest(compound.principal, compound.annualRatePercent, compound.years, compound.compoundTimesPerYear);
      return { success: true, operation: 'compound', ...res };
    }

    if (operation === 'stats' && Array.isArray(numbers)) {
      const res = calculateStatistics(numbers);
      return { success: true, operation: 'stats', ...res };
    }

    return { error: `Unsupported computation operation: ${operation}` };
  } catch (err) {
    return { error: err.message || 'Calculation error' };
  }
}
