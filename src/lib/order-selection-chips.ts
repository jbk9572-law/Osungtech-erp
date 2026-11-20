import type { BadgeTone } from "@/components/grid/badge";
import { paymentStatusBadge, type OrderPaymentStatus } from "@/lib/order-payment-status";

// 매출/매입 목록 오른쪽 상세 패널의 제목 아래 색 칩과 윗줄 강조색 — 두 목록이 같은 규칙을 쓰게 한 곳에 둔다.
//  칩: 구분(매출/반품/샘플/수금 · 매입/지급) → 과세구분 → 수금/지급 상태 → 계산서 → 이월
//  강조색: 반품=빨강, 미수/미지급=노랑, 완료=초록, 그 외=기본(파랑)
export type OrderChip = { tone: BadgeTone; label: string };
export type OrderAccent = "primary" | "danger" | "warn" | "success";

export function orderSelectionChips(opts: {
  kindLabel: string;
  kindTone: BadgeTone;
  taxType?: string | null;
  paymentStatus?: OrderPaymentStatus;
  paymentLabels: { paid: string; partial: string; unpaid: string };
  /** 수금·지급 행처럼 상태가 의미 없는 행 */
  skipPayment?: boolean;
  /** 계산서 칩 문구(발행/수취된 전표만 넘긴다) */
  invoiceLabel?: string | null;
  isCarryover?: boolean;
  isReturn?: boolean;
}): { chips: OrderChip[]; accent: OrderAccent } {
  const pay = opts.skipPayment ? null : paymentStatusBadge(opts.paymentStatus, opts.paymentLabels);
  const chips: OrderChip[] = [{ tone: opts.kindTone, label: opts.kindLabel }];
  if (opts.taxType) chips.push({ tone: opts.taxType === "과세" ? "muted" : "warn", label: opts.taxType });
  if (pay) chips.push(pay);
  if (opts.invoiceLabel) chips.push({ tone: "ok", label: opts.invoiceLabel });
  if (opts.isCarryover) chips.push({ tone: "carry", label: "익월 이월" });
  const accent: OrderAccent = opts.isReturn ? "danger" : pay?.tone === "danger" ? "warn" : pay?.tone === "ok" ? "success" : "primary";
  return { chips, accent };
}
