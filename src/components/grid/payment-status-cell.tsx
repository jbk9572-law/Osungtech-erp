import type { CSSProperties } from "react";
import { GridBadge } from "@/components/grid/badge";
import { paymentStatusBadge, type OrderPaymentStatus } from "@/lib/order-payment-status";

// 매출/매입 목록의 "수금/지급" 상태 칸 — 테마 기능 paymentStatusColumn이 꺼지면 호출한 표가 style로 숨긴다(칸 수 계산도 같이).
// skip: 수금·지급 행처럼 상태가 의미 없는 행. 칸 수가 테마마다 달라지지 않게 칸 자체는 항상 그린다.
export function PaymentStatusCell({
  status,
  skip,
  labels,
  style,
}: {
  status: OrderPaymentStatus | undefined;
  skip?: boolean;
  labels: { paid: string; partial: string; unpaid: string };
  /** 칸 숨김(테마 기능이 꺼졌을 때 display:none)을 호출한 표가 넘긴다. */
  style?: CSSProperties;
}) {
  const badge = skip ? null : paymentStatusBadge(status, labels);
  return <td style={style}>{badge ? <GridBadge tone={badge.tone}>{badge.label}</GridBadge> : "-"}</td>;
}
