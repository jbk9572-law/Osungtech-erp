// 포장수량(1박스당 수량) 옆에 이번 주문의 박스 수까지 같이 보여줘서
// "50*20" 처럼 한눈에 총 몇 박스인지 알 수 있게 한다. 단어("박스") 없이
// 숫자만 곱셈 형태로 보여준다.
export function formatPackageQty(
  basePackageQty: number | string | null | undefined,
  quantity: number
): string {
  const base = basePackageQty != null ? Number(basePackageQty) : null;
  if (!base) return "-";

  const boxCount = quantity > 0 ? quantity / base : 0;
  const boxLabel = Number.isInteger(boxCount) ? String(boxCount) : boxCount.toFixed(2);
  return `${base.toLocaleString()}*${boxLabel}`;
}
