import { formatNumber } from "@/lib/format-number";

// 매출 품목 줄 아래의 재고 계산식 안내 — "재고 900R - 출고 100R = 800R"처럼 계산식 그대로 보여준다.
// "재고 900"만 보여주면 이 출고를 반영하기 전인지 후인지 헷갈린다는 지적이 있어 식으로 보여주고,
// 잔여 수량이 마이너스면 그 자체로 초과분이라 빨간색으로 강조한다. 같은 상품이 한 주문 안에서 여러 줄로 나뉘어 있으면
// (관리번호별 분할 등) 그 줄들의 합계(totalQty)로 부족 여부를 판단해야 실제 재고를 넘는 걸 놓치지 않는다.
// 반품은 출고가 아니라 입고(재고 증가)라 부족 여부를 따지지 않고 늘어난 뒤 수량만 보여준다.
export function OrderRowStockHint({
  stock,
  originalQty,
  unit,
  quantity,
  totalQty,
  isReturn,
}: {
  stock: number;
  /** 수정 중인 전표가 이미 차감해 둔 수량(되돌려 계산) */
  originalQty: number;
  unit: string;
  quantity: number;
  /** 같은 상품이 이 주문 안에서 여러 줄일 때 그 합계 */
  totalQty: number;
  isReturn: boolean;
}) {
  const availableStock = stock + originalQty;
  if (isReturn) {
    return (
      <p className="text-[10.5px] erp-u-danger">
        재고 {formatNumber(availableStock)}
        {unit} + 반품 {formatNumber(quantity)}
        {unit} = {formatNumber(availableStock + quantity)}
        {unit}
      </p>
    );
  }
  const remaining = availableStock - totalQty;
  const short = remaining < 0;
  return (
    <p className="text-[10.5px]" style={{ color: short ? "var(--erp-danger)" : "var(--erp-primary)" }}>
      재고 {formatNumber(availableStock)}
      {unit} - 출고 {formatNumber(quantity)}
      {unit}
      {totalQty !== quantity && ` (합계 ${formatNumber(totalQty)}${unit})`}
      {" = "}
      {formatNumber(remaining)}
      {unit}
      {short && " (부족)"}
    </p>
  );
}

// 전표 표의 "재고 확인" 칸(voucherLayout 테마) — 위 안내문과 같은 계산을 점 + 한 줄로 보여준다.
// 부족(빨강) / 여유(초록) / 반품은 늘어나는 수량(파랑). 품목이 없으면 비워 둔다.
export function OrderRowStockCell({ stock, originalQty, unit, quantity, totalQty, isReturn }: {
  stock: number; originalQty: number; unit: string; quantity: number; totalQty: number; isReturn: boolean;
}) {
  const available = stock + originalQty;
  if (isReturn) return <span className="erp-stock-cell erp-stock-cell-info">+{formatNumber(quantity)}{unit} 입고</span>;
  const remaining = available - totalQty;
  return remaining < 0 ? (
    <span className="erp-stock-cell erp-stock-cell-danger">{formatNumber(remaining)}{unit} 부족</span>
  ) : (
    <span className="erp-stock-cell erp-stock-cell-ok">{formatNumber(remaining)}{unit} 여유</span>
  );
}
