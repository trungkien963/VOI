export type CalculatorKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '000'
  | '+'
  | '-'
  | '×'
  | '÷'
  | 'C'
  | 'BACKSPACE'
  | '=';

const OPERATORS = new Set(['+', '-', '×', '÷']);

export function isOperatorToken(char: string | undefined): boolean {
  return char !== undefined && OPERATORS.has(char);
}

export function hasPendingOperator(expression: string): boolean {
  const trimmed = expression.trim();
  for (const op of OPERATORS) {
    if (trimmed.includes(op)) {
      return true;
    }
  }
  return false;
}

/**
 * Safely evaluates a Money+ style arithmetic expression (e.g. "360000 ÷ 3" or "45000 + 25000")
 * without using eval(), returning a non-negative integer in minor units (VND).
 */
export function evaluateMoneyExpression(expression: string): number {
  const normalized = expression
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷');

  if (!normalized) return 0;

  // Tokenize numbers and operators (+, -, ×, ÷)
  const tokens: Array<number | string> = [];
  let numberBuffer = '';

  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i] ?? '';
    if (ch >= '0' && ch <= '9') {
      numberBuffer += ch;
    } else if (isOperatorToken(ch)) {
      if (numberBuffer.length > 0) {
        tokens.push(Number(numberBuffer));
        numberBuffer = '';
      }
      // Replace trailing operator if user pressed two operators consecutively
      const lastIdx = tokens.length - 1;
      if (lastIdx >= 0 && typeof tokens[lastIdx] === 'string') {
        tokens[lastIdx] = ch;
      } else if (tokens.length > 0) {
        tokens.push(ch);
      }
    }
  }

  if (numberBuffer.length > 0) {
    tokens.push(Number(numberBuffer));
  }

  // Drop trailing operator if expression is incomplete (e.g. "45000+")
  if (tokens.length > 0 && typeof tokens[tokens.length - 1] === 'string') {
    tokens.pop();
  }

  if (tokens.length === 0) return 0;

  // Pass 1: Multiplication & Division
  const pass1: Array<number | string> = [];
  let idx = 0;
  while (idx < tokens.length) {
    const token = tokens[idx] ?? 0;
    if ((token === '×' || token === '÷') && pass1.length > 0 && idx + 1 < tokens.length) {
      const left = Number(pass1.pop() ?? 0);
      const right = Number(tokens[idx + 1] ?? 1);
      const computed = token === '×' ? left * right : right === 0 ? left : Math.round(left / right);
      pass1.push(computed);
      idx += 2;
    } else {
      pass1.push(token);
      idx += 1;
    }
  }

  // Pass 2: Addition & Subtraction
  let result = Number(pass1[0] ?? 0);
  for (let j = 1; j < pass1.length; j += 2) {
    const op = pass1[j];
    const nextVal = Number(pass1[j + 1] ?? 0);
    if (op === '+') result += nextVal;
    if (op === '-') result -= nextVal;
  }

  return Math.max(0, Math.round(result));
}

export function applyKeypadInput(currentExpr: string, key: CalculatorKey): string {
  if (key === 'C') return '';
  if (key === 'BACKSPACE') {
    return currentExpr.slice(0, -1);
  }
  if (key === '=') {
    const val = evaluateMoneyExpression(currentExpr);
    return val > 0 ? String(val) : '';
  }

  if (isOperatorToken(key)) {
    if (!currentExpr) return '';
    const lastChar = currentExpr[currentExpr.length - 1];
    if (isOperatorToken(lastChar)) {
      return `${currentExpr.slice(0, -1)}${key}`;
    }
    return `${currentExpr}${key}`;
  }

  if (key === '000') {
    if (!currentExpr || isOperatorToken(currentExpr[currentExpr.length - 1])) {
      return currentExpr;
    }
    return `${currentExpr}000`;
  }

  if (currentExpr === '0') {
    return key;
  }

  return `${currentExpr}${key}`;
}
