import { formatNumber } from "@/lib/format-number";

// 전표 한 줄(품목 여러 개)의 수량을 단위별로 따로 더해 보여준다 — "225 ROLL · 532 KG".
// 예전엔 단위가 달라도 그냥 더해(225+532=757) 첫 품목의 단위만 붙였다("757 ROLL") — 목록·합계·복사한 이미지에 틀린 숫자가 나갔다.
// 같은 단위끼리만 더하고, 단위가 하나면 예전과 똑같이 "757 ROLL"로 나온다. 단위가 없는 품목은 단위 없이 따로 묶는다.
export type QtyItem = { quantity: number; unit?: string | null };

export function sumQuantityByUnit(items: readonly QtyItem[]): { unit: string; quantity: number }[] {
  const order: string[] = [];
  const sums = new Map<string, number>();
  for (const it of items) {
    const unit = (it.unit ?? "").trim();
    if (!sums.has(unit)) order.push(unit);
    sums.set(unit, (sums.get(unit) ?? 0) + Number(it.quantity));
  }
  return order.map((unit) => ({ unit, quantity: sums.get(unit) ?? 0 }));
}

export function quantityLabelByUnit(items: readonly QtyItem[]): string {
  return sumQuantityByUnit(items)
    .map((s) => `${formatNumber(s.quantity)}${s.unit ? ` ${s.unit}` : ""}`)
    .join(" · ");
}
