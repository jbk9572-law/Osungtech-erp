export type TodoMemoLine = { raw: string; name: string; spec: string | null; qty: string | null };

// "+ 품목 추가"로 넣은 줄은 "품목명 (규격) : 수량" 형식이라 이 패턴으로 파싱된다.
// 형식에 안 맞는 줄(예전에 자유롭게 쓴 메모)은 spec/qty가 null이 되고 raw
// 전체가 name에 그대로 담겨, 표에서도 원래 텍스트가 그대로 보인다.
const LINE_PATTERN = /^(.+?)\s*(?:\(([^)]*)\))?\s*:\s*([\d,]+)\s*$/;

export function parseTodoMemoLines(memo: string | null | undefined): TodoMemoLine[] {
  if (!memo) return [];
  return memo
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = raw.match(LINE_PATTERN);
      if (!match) return { raw, name: raw, spec: null, qty: null };
      const [, name, spec, qty] = match;
      return { raw, name: name.trim(), spec: spec?.trim() || null, qty };
    });
}

export function countTodoMemoLines(memo: string | null | undefined): number {
  if (!memo) return 0;
  return memo
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export function formatTodoMemoLine(name: string, spec: string, qty: number): string {
  return spec ? `${name} (${spec}) : ${qty.toLocaleString()}` : `${name} : ${qty.toLocaleString()}`;
}
