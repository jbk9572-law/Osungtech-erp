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

// "1.5박스"처럼 박스 수만 뽑아 쓰고 싶은 자리(수량 입력칸 옆에 붙이는 등)를
// 위해 분리해뒀다 — formatQuantityWithBoxes와 같은 계산을 여기서 한 번만 한다.
// 포장수량이 없는 품목은 null을 돌려줘서 호출부가 아예 안 보여줄 수 있게 한다.
export function formatBoxCount(
  quantity: number,
  basePackageQty: number | string | null | undefined
): string | null {
  const base = basePackageQty != null ? Number(basePackageQty) : null;
  if (!base) return null;

  const boxCount = quantity / base;
  const boxLabel = Number.isInteger(boxCount) ? boxCount.toLocaleString() : boxCount.toFixed(1);
  return `${boxLabel}박스`;
}

// 재고수량 옆에 몇 박스 분량인지 괄호로 같이 보여준다(예: "500 (10박스)").
// 포장수량이 없는 품목은 그냥 수량만 보여준다.
export function formatQuantityWithBoxes(
  quantity: number,
  basePackageQty: number | string | null | undefined
): string {
  const qtyLabel = quantity.toLocaleString();
  const boxLabel = formatBoxCount(quantity, basePackageQty);
  return boxLabel ? `${qtyLabel} (${boxLabel})` : qtyLabel;
}
