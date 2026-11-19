import { evalFormula } from "@/lib/eval-formula";

// 수량·단가 칸에 엑셀식("=600*2")으로 입력한 계산식을 공용 저장소(input_formulas, migration 277)에 남기고 다시 읽어 줄에 붙이는 공용 로직.
// 모든 화면이 같은 규칙을 쓴다: 저장 때 build…로 행을 만들고, 열 때 attach…로 현재 줄(품목 키 + 식 결과가 값과 같은 줄)에 짝짓는다.
// 줄 순서가 저장 때마다 바뀔 수 있어 위치가 아니라 "줄 키 + 결과 일치"로 짝짓는다 — 값이 바뀐 줄에 옛 식이 붙지 않는다.
export type FormulaField = "quantity" | "unit_price";
export type FormulaRow = { line_key: string; field: FormulaField; formula: string };

const MAX_FORMULA_LENGTH = 80;
const MAX_STORED_FORMULAS = 1000;

export function itemKey(item: { productId?: string | null; customName?: string | null }): string {
  return item.productId ? item.productId : `c:${(item.customName ?? "").trim()}`;
}

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** 식이 "=..." 형태이고 계산 결과가 value와 같을 때만 그 식을 돌려준다(아니면 null). */
export function sanitizeFormula(text: unknown, value: number): string | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith("=") || trimmed.length > MAX_FORMULA_LENGTH) return null;
  const result = evalFormula(trimmed.slice(1));
  return result !== null && sameNumber(result, value) ? trimmed : null;
}

type PostedItem = {
  productId?: string | null;
  customName?: string | null;
  quantity: number;
  quantityFormula?: unknown;
  unitPriceFormula?: unknown;
  unitPrice?: number;
  unitCost?: number;
  estimatedUnitPrice?: number;
};

/** 서버 액션: 브라우저가 보낸 품목에서 검증된 식만 골라 저장용 행으로 만든다. */
export function buildFormulaRows(items: PostedItem[]): FormulaRow[] {
  const out: FormulaRow[] = [];
  for (const item of items) {
    const key = itemKey(item);
    const q = sanitizeFormula(item.quantityFormula, item.quantity);
    if (q) out.push({ line_key: key, field: "quantity", formula: q });
    const p = sanitizeFormula(item.unitPriceFormula, item.unitPrice ?? item.unitCost ?? item.estimatedUnitPrice ?? 0);
    if (p) out.push({ line_key: key, field: "unit_price", formula: p });
    if (out.length >= MAX_STORED_FORMULAS) break;
  }
  return out.slice(0, MAX_STORED_FORMULAS);
}

type RowLike = { productId?: string | null; customName?: string | null; quantity: number; price: number };

/** 수정/상세 화면: 저장된 식을 현재 줄에 짝지어 돌려준다. 줄마다 {quantityFormula, unitPriceFormula}. */
export function attachFormulaRows(
  rows: RowLike[],
  stored: readonly { line_key: string; field: string; formula: string }[],
): { quantityFormula: string | null; unitPriceFormula: string | null }[] {
  const pool = stored.filter((f) => f && typeof f.line_key === "string" && typeof f.formula === "string");
  const used = new Set<number>();
  const take = (key: string, field: FormulaField, value: number): string | null => {
    const idx = pool.findIndex((f, i) => !used.has(i) && f.line_key === key && f.field === field && sanitizeFormula(f.formula, value) !== null);
    if (idx < 0) return null;
    used.add(idx);
    return pool[idx].formula;
  };
  return rows.map((row) => {
    const key = itemKey(row);
    return { quantityFormula: take(key, "quantity", row.quantity), unitPriceFormula: take(key, "unit_price", row.price) };
  });
}

/** DB 함수(RPC)에 넘기는 품목에서 식 칸을 뺀다 — 식은 별도 저장소(input_formulas)에 기록한다. */
export function withoutFormulaFields<T extends { quantityFormula?: unknown; unitPriceFormula?: unknown }>(
  items: T[],
): Omit<T, "quantityFormula" | "unitPriceFormula">[] {
  return items.map((item) => {
    const rest = { ...item };
    delete rest.quantityFormula;
    delete rest.unitPriceFormula;
    return rest;
  });
}
