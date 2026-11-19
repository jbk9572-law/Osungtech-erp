import { GridBadge } from "@/components/grid/badge";
import { formatNumber } from "@/lib/format-number";
import { PARTY_CREDIT_BADGE, partyCreditStatus } from "@/lib/party-credit-status";

// 거래처/공급처 목록 행 아래줄의 "미수(미지급) 잔액 + 연체/주의" — 목록 행이 같은 모양을 쓰게 한 곳에서 그린다.
// 표시 여부는 테마 토큰(--erp-split-meta-display) — 클래식은 숨김. 잔액이 없으면 아무것도 그리지 않는다.
export function PartyBalanceMeta({
  label,
  balance,
  oldestUnpaidDate,
  lastOrderDate,
}: {
  label: string;
  balance: number | undefined;
  oldestUnpaidDate?: string | null;
  /** 최근 거래일(YYYY-MM-DD) — 거래가 한 번도 없으면 비워 둔다. */
  lastOrderDate?: string | null;
}) {
  const hasBalance = !!balance && balance > 0;
  if (!hasBalance && !lastOrderDate) return null;
  const status = hasBalance ? partyCreditStatus(balance, oldestUnpaidDate) : "ok";
  const badge = status === "ok" ? null : PARTY_CREDIT_BADGE[status];
  return (
    <div className="erp-split-list-row-meta">
      {hasBalance && (
        <span>
          {label} <b>{formatNumber(balance)}</b>
        </span>
      )}
      {lastOrderDate && <span>최근 거래 {lastOrderDate}</span>}
      {badge && <GridBadge tone={badge.tone}>{badge.label}</GridBadge>}
    </div>
  );
}
