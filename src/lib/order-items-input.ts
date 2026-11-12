// 매출/매입 등록·수정 서버 액션이 브라우저에서 받은 품목 JSON을 검증하는 공용 함수.
// 이전에는 quantity > 0만 확인해서 문자열/NaN/비정상적으로 큰 값, 배열이 아닌 값, null 품목이
// 그대로 DB 함수까지 가거나(500 오류, DB 오류 원문 노출) 집계를 망가뜨릴 수 있었다.
// 단가는 음수를 허용한다(할인 줄 용도) — 대신 숫자가 아니거나 비정상적으로 큰 값만 거른다.
export const MAX_ORDER_ITEMS = 500;
export const MAX_ITEM_QUANTITY = 1_000_000_000;
export const MAX_ITEM_AMOUNT_UNIT = 1_000_000_000_000; // 단가 상한(1조)
const MAX_TEXT_LENGTH = 500;

function isFiniteWithin(value: unknown, abs: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= abs;
}

export type ParsedOrderItem = {
  productId?: string | null;
  customName?: string | null;
  quantity: number;
  unitPrice?: number;
  unitCost?: number;
  [key: string]: unknown;
};

// 형식이 잘못된 입력은 null(=오류 처리)로 돌려주고, 정상 형식이면 수량 0 이하/품목 없음 줄만 걸러낸다.
export function parseOrderItems<T extends ParsedOrderItem>(raw: string, opts: { allowCustom: boolean }): T[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_ORDER_ITEMS) return null;

  const result: T[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const item = entry as T;
    if (!isFiniteWithin(item.quantity, MAX_ITEM_QUANTITY)) return null;
    if (item.unitPrice !== undefined && !isFiniteWithin(item.unitPrice, MAX_ITEM_AMOUNT_UNIT)) return null;
    if (item.unitCost !== undefined && !isFiniteWithin(item.unitCost, MAX_ITEM_AMOUNT_UNIT)) return null;
    for (const key of ["productId", "customName", "spec", "remark", "lotNumber"]) {
      const v = (item as Record<string, unknown>)[key];
      if (v !== undefined && v !== null && (typeof v !== "string" || v.length > MAX_TEXT_LENGTH)) return null;
    }
    const hasTarget = opts.allowCustom ? item.productId || item.customName : item.productId;
    if (hasTarget && item.quantity > 0) result.push(item);
  }
  return result;
}
