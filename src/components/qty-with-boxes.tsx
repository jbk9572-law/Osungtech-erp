import { formatBoxCount } from "@/lib/package-qty";

// formatQuantityWithBoxes와 같은 계산이지만, "(N박스)" 부분만 빨간 글씨로
// 따로 강조해서 보여줘야 하는 자리(사이트 전체의 박스수량 표기)에 쓴다 —
// 문자열 하나로 합쳐 리턴하는 formatQuantityWithBoxes로는 일부만 색을
// 다르게 줄 수 없어서 JSX를 직접 조립하는 컴포넌트로 분리했다. 카톡복사
// 텍스트처럼 실제로 일반 텍스트로 나가야 하는 자리에는 여전히
// formatQuantityWithBoxes(문자열)를 그대로 쓴다.
export function QtyWithBoxes({
  quantity,
  basePackageQty,
  unit,
}: {
  quantity: number;
  basePackageQty: number | string | null | undefined;
  unit?: string;
}) {
  const qtyLabel = unit ? `${quantity.toLocaleString()} ${unit}` : quantity.toLocaleString();
  const boxLabel = formatBoxCount(quantity, basePackageQty);
  return (
    <>
      {qtyLabel}
      {boxLabel && <span style={{ color: "var(--erp-danger)" }}> ({boxLabel})</span>}
    </>
  );
}
