import { formatNumber } from "@/lib/format-number";

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
  return `${formatNumber(base)}*${boxLabel}`;
}

// 단위가 리터 계열(L, ML, KL, 18L, 20L처럼 숫자·M·K가 붙은 L)이면 "박스"가 아니라 "포"로 부른다. "ROLL"처럼 글자가 더 붙은 단위는
// L로 끝나도 해당하지 않는다(필름·테이프는 박스). 박스 라벨을 만드는 모든 자리가 이 함수 하나를 쓴다.
const LITER_UNIT = /^(?:\d+(?:\.\d+)?\s*)?[MK]?L$/i;
export function packageUnitLabel(unit?: string | null): "박스" | "포" {
  return unit && LITER_UNIT.test(unit.trim()) ? "포" : "박스";
}

// "1.5박스"처럼 박스 수만 뽑아 쓰고 싶은 자리(수량 입력칸 옆에 붙이는 등)를
// 위해 분리해뒀다 — formatQuantityWithBoxes와 같은 계산을 여기서 한 번만 한다.
// 포장수량이 없는 품목은 null을 돌려줘서 호출부가 아예 안 보여줄 수 있게 한다.
export function formatBoxCount(
  quantity: number,
  basePackageQty: number | string | null | undefined,
  unit?: string | null
): string | null {
  const base = basePackageQty != null ? Number(basePackageQty) : null;
  if (!base) return null;

  const boxCount = quantity / base;
  const boxLabel = Number.isInteger(boxCount) ? formatNumber(boxCount) : boxCount.toFixed(1);
  return `${boxLabel}${packageUnitLabel(unit)}`;
}

// 재고수량 옆에 몇 박스 분량인지 괄호로 같이 보여준다(예: "500 (10박스)").
// 포장수량이 없는 품목은 그냥 수량만 보여준다. unit을 넘기면 "수량 단위
// (N박스)" 순서로 붙여준다("500 (10박스) EA"처럼 단위가 박스 표시 뒤로
// 밀려나면 어색하다는 지적이 있었다) — 호출부가 단위를 따로 이어붙이는
// 자리마다 이 함수 하나로 통일한다.
export function formatQuantityWithBoxes(
  quantity: number,
  basePackageQty: number | string | null | undefined,
  unit?: string
): string {
  const qtyLabel = unit ? `${formatNumber(quantity)} ${unit}` : formatNumber(quantity);
  const boxLabel = formatBoxCount(quantity, basePackageQty, unit);
  return boxLabel ? `${qtyLabel} (${boxLabel})` : qtyLabel;
}
