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

// Safe recursive descent arithmetic expression evaluator
export function evaluateMathExpression(expr) {
  if (typeof expr !== 'string') throw new TypeError('Expression must be a string');
  const cleaned = expr.trim();
  if (!cleaned) throw new Error('Empty expression');

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
      if (Number.isNaN(num)) throw new Error(`Invalid number: ${numStr}`);
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
      if (op === '/' && right === 0) throw new Error('Division by zero');
      left = op === '*' ? left * right : op === '/' ? left / right : left % right;
    }
    return left;
  }

  function parseFactor() {
    let left = parsePower();
    while (peek() && peek().value === '^') {
      consume();
      const right = parsePower();
      left = Math.pow(left, right);
    }
    return left;
  }

  function parsePower() {
    const token = peek();
    if (!token) throw new Error('Unexpected end of expression');

    // Unary plus / minus
    if (token.type === 'op' && (token.value === '+' || token.value === '-')) {
      consume();
      const val = parsePower();
      return token.value === '-' ? -val : val;
    }

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
  return Number.isFinite(result) ? result : NaN;
}

// Financial calculations (loan payment, compound interest)
export function calculateLoanMonthlyPayment(principal, annualRatePercent, termYears) {
  const p = Number(principal);
  const rAnnual = Number(annualRatePercent) / 100;
  const nMonths = Number(termYears) * 12;
  if (p <= 0 || nMonths <= 0) throw new Error('Principal and term must be positive numbers');
  if (rAnnual === 0) return p / nMonths;
  const rMonthly = rAnnual / 12;
  const monthly = (p * rMonthly * Math.pow(1 + rMonthly, nMonths)) / (Math.pow(1 + rMonthly, nMonths) - 1);
  const totalPaid = monthly * nMonths;
  const totalInterest = totalPaid - p;
  return {
    monthlyPayment: Math.round(monthly * 100) / 100,
    totalPayment: Math.round(totalPaid * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    termMonths: nMonths
  };
}

export function calculateCompoundInterest(principal, annualRatePercent, years, compoundTimesPerYear = 1) {
  const p = Number(principal);
  const r = Number(annualRatePercent) / 100;
  const t = Number(years);
  const n = Number(compoundTimesPerYear) || 1;
  const amount = p * Math.pow(1 + r / n, n * t);
  return {
    futureValue: Math.round(amount * 100) / 100,
    interestEarned: Math.round((amount - p) * 100) / 100,
    initialPrincipal: p
  };
}

// Statistical metrics on arrays of numbers
export function calculateStatistics(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) throw new Error('Array of numbers required');
  const valid = numbers.map(Number).filter((n) => Number.isFinite(n));
  if (valid.length === 0) throw new Error('No valid numbers found');
  const sorted = [...valid].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    count: sorted.length,
    sum: Math.round(sum * 100) / 100,
    average: Math.round(avg * 100) / 100,
    median: Math.round(median * 100) / 100,
    min,
    max
  };
}

// Unified agent tool handler
export function runQuickCompute(input = {}) {
  const { operation = 'evaluate', expression, numbers, loan, compound } = input;

  try {
    if (operation === 'evaluate' || expression) {
      const expr = String(expression || '').trim();
      if (!expr) return { error: 'No expression provided to evaluate.' };
      const val = evaluateMathExpression(expr);
      return {
        success: true,
        operation: 'evaluate',
        expression: expr,
        result: Math.round(val * 10000) / 10000,
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
