import { GridBadge } from "@/components/grid/badge";
import { formatNumber } from "@/lib/format-number";
import { PARTY_CREDIT_BADGE, partyCreditStatus } from "@/lib/party-credit-status";

// 거래처/공급처 목록 행 아래줄의 "미수(미지급) 잔액 + 연체/주의" — 목록 행이 같은 모양을 쓰게 한 곳에서 그린다.
// 표시 여부는 테마 토큰(--erp-split-meta-display) — 클래식은 숨김. 잔액이 없으면 아무것도 그리지 않는다.
export function PartyBalanceMeta({
  label,
  balance,
  oldestUnpaidDate,
}: {
  label: string;
  balance: number | undefined;
  oldestUnpaidDate?: string | null;
}) {
  if (!balance || balance <= 0) return null;
  const status = partyCreditStatus(balance, oldestUnpaidDate);
  const badge = status === "ok" ? null : PARTY_CREDIT_BADGE[status];
  return (
    <div className="erp-split-list-row-meta">
      <span>
        {label} <b>{formatNumber(balance)}</b>
      </span>
      {badge && <GridBadge tone={badge.tone}>{badge.label}</GridBadge>}
    </div>
  );
}
