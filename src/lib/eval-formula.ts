// 엑셀처럼 "=1+1" 같은 간단한 사칙연산 수식을 계산한다. eval/Function을 쓰지
// 않고 직접 파싱해서, 숫자·+·-·*·/·()·공백 외의 입력은 전부 실패로 처리한다.
export function evalFormula(expr: string): number | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;
  if (!/^[0-9+\-*/().\s]+$/.test(trimmed)) return null;

  let pos = 0;

  function peek(): string {
    return trimmed[pos];
  }

  function parseExpression(): number | null {
    let value = parseTerm();
    if (value === null) return null;
    while (peek() === "+" || peek() === "-") {
      const op = trimmed[pos];
      pos++;
      const rhs = parseTerm();
      if (rhs === null) return null;
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number | null {
    let value = parseFactor();
    if (value === null) return null;
    while (peek() === "*" || peek() === "/") {
      const op = trimmed[pos];
      pos++;
      const rhs = parseFactor();
      if (rhs === null) return null;
      if (op === "/" && rhs === 0) return null;
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseFactor(): number | null {
    skipSpaces();
    if (peek() === "-") {
      pos++;
      const value = parseFactor();
      return value === null ? null : -value;
    }
    if (peek() === "+") {
      pos++;
      return parseFactor();
    }
    if (peek() === "(") {
      pos++;
      const value = parseExpression();
      skipSpaces();
      if (peek() !== ")") return null;
      pos++;
      skipSpaces();
      return value;
    }
    const start = pos;
    while (pos < trimmed.length && /[0-9.]/.test(trimmed[pos])) pos++;
    if (pos === start) return null;
    const numText = trimmed.slice(start, pos);
    skipSpaces();
    const n = Number(numText);
    return Number.isFinite(n) ? n : null;
  }

  function skipSpaces() {
    while (trimmed[pos] === " ") pos++;
  }

  skipSpaces();
  const result = parseExpression();
  skipSpaces();
  if (result === null || pos !== trimmed.length) return null;
  return result;
}
