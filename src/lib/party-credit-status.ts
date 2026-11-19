import { RECEIVABLE_OVERDUE_DAYS, daysSince } from "@/lib/ar-ap";

// 거래처/공급처 목록의 신용 상태 — 미수금(미지급금) 현황과 같은 숫자(get_*_balances)에서 파생한다.
//   overdue : 잔액이 있고 가장 오래된 미결제 전표가 기준일(30일) 이상 지남 → 연체
//   caution : 잔액이 있으나 기준일 이내 → 주의
//   ok      : 잔액이 없거나 초과 입금(마이너스)
export type PartyCreditStatus = "overdue" | "caution" | "ok";

export function partyCreditStatus(
  balance: number,
  oldestUnpaidDate: string | null | undefined,
  today?: string,
): PartyCreditStatus {
  if (!(balance > 0)) return "ok";
  if (oldestUnpaidDate && daysSince(oldestUnpaidDate, today) >= RECEIVABLE_OVERDUE_DAYS) return "overdue";
  return "caution";
}

export const PARTY_CREDIT_BADGE: Record<Exclude<PartyCreditStatus, "ok">, { tone: "danger" | "warn"; label: string }> = {
  overdue: { tone: "danger", label: "연체" },
  caution: { tone: "warn", label: "주의" },
};
