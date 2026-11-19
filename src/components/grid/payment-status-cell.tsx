import { GridBadge } from "@/components/grid/badge";
import { paymentStatusBadge, type OrderPaymentStatus } from "@/lib/order-payment-status";

// 매출/매입 목록의 "수금/지급" 상태 칸 — 테마 전용 칸(.erp-col-theme-only)이라 클래식에서는 보이지 않는다.
// skip: 수금·지급 행처럼 상태가 의미 없는 행. 칸 수가 테마마다 달라지지 않게 칸 자체는 항상 그린다.
export function PaymentStatusCell({
  status,
  skip,
  labels,
}: {
  status: OrderPaymentStatus | undefined;
  skip?: boolean;
  labels: { paid: string; partial: string; unpaid: string };
}) {
  const badge = skip ? null : paymentStatusBadge(status, labels);
  return <td className="erp-col-theme-only">{badge ? <GridBadge tone={badge.tone}>{badge.label}</GridBadge> : "-"}</td>;
}
