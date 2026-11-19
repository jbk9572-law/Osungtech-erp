import { evalFormula } from "@/lib/eval-formula";

// 품목 칸에 엑셀식("=600*2")으로 입력한 계산식을 전표(sales_orders/purchase_orders.item_formulas)에 함께 저장하고 다시 읽는 공용 로직.
// 저장 형식은 식이 있는 줄만 담은 배열이다. 줄 순서가 DB에서 달라질 수 있어(수정 시 다시 만들어짐) 위치가 아니라
// "품목 키 + 계산 결과가 현재 수량/단가와 같은지"로 줄과 식을 짝짓는다 — 값이 바뀐 줄에 옛 식이 붙는 일이 없다.
export type ItemFormula = { k: string; q?: string; p?: string };

const MAX_FORMULA_LENGTH = 80;
const MAX_STORED_FORMULAS = 500;

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
};

/** 서버 액션: 브라우저가 보낸 품목에서 검증된 식만 골라 저장용 배열로 만든다. */
export function buildItemFormulas(items: PostedItem[]): ItemFormula[] {
  const out: ItemFormula[] = [];
  for (const item of items) {
    const q = sanitizeFormula(item.quantityFormula, item.quantity);
    const price = item.unitPrice ?? item.unitCost ?? 0;
    const p = sanitizeFormula(item.unitPriceFormula, price);
    if (q || p) out.push({ k: itemKey(item), ...(q ? { q } : {}), ...(p ? { p } : {}) });
    if (out.length >= MAX_STORED_FORMULAS) break;
  }
  return out;
}

type RowLike = { productId?: string | null; customName?: string | null; quantity: number; price: number };

/** 수정 화면: 저장된 식을 현재 줄(품목 키·수량·단가가 식 결과와 맞는 줄)에 짝지어 돌려준다. 줄마다 {quantityFormula, unitPriceFormula}. */
export function attachItemFormulas(rows: RowLike[], stored: unknown): { quantityFormula: string | null; unitPriceFormula: string | null }[] {
  const pool = Array.isArray(stored)
    ? (stored as ItemFormula[]).filter((f) => f && typeof f === "object" && typeof f.k === "string")
    : [];
  const used = new Set<number>();
  return rows.map((row) => {
    const key = itemKey(row);
    const idx = pool.findIndex((f, i) => !used.has(i) && f.k === key && matches(f, row));
    if (idx < 0) return { quantityFormula: null, unitPriceFormula: null };
    used.add(idx);
    const f = pool[idx];
    return {
      quantityFormula: sanitizeFormula(f.q, row.quantity),
      unitPriceFormula: sanitizeFormula(f.p, row.price),
    };
  });
}

function matches(f: ItemFormula, row: RowLike): boolean {
  const qOk = f.q === undefined || sanitizeFormula(f.q, row.quantity) !== null;
  const pOk = f.p === undefined || sanitizeFormula(f.p, row.price) !== null;
  return qOk && pOk && (f.q !== undefined || f.p !== undefined);
}
