"use client";

import { useEffect, useState } from "react";
import { GridBadge } from "@/components/grid/badge";
import { useThemeFeatures } from "@/lib/erp-theme-features";
import { formatNumber } from "@/lib/format-number";
import { PARTY_CREDIT_BADGE, partyCreditStatus } from "@/lib/party-credit-status";
import { loadPartyContext, type PartyContext } from "@/lib/party-context-actions";

// 전표 모달 제목 아래 "거래처 정보 줄" — 미수(미지급) 잔액 + 연체/주의 배지 + 최근 거래일 + 결제조건. voucherLayout 테마 전용.
// 거래처를 바꿀 때마다 그 한 곳만 불러오고, 늦게 도착한 이전 응답은 버린다.
export function PartyContextStrip({ kind, partyId, partyName }: { kind: "customer" | "supplier"; partyId: string; partyName: string }) {
  const { voucherLayout } = useThemeFeatures();
  const [loaded, setLoaded] = useState<{ id: string; ctx: PartyContext | null } | null>(null);
  useEffect(() => {
    if (!voucherLayout || !partyId) return;
    let stale = false;
    loadPartyContext(kind, partyId).then((ctx) => !stale && setLoaded({ id: partyId, ctx }));
    return () => {
      stale = true;
    };
  }, [voucherLayout, kind, partyId]);
  if (!voucherLayout || !partyId || loaded?.id !== partyId) return null;
  const ctx = loaded.ctx;
  const hasBalance = !!ctx && ctx.balance > 0;
  const status = ctx && hasBalance ? partyCreditStatus(ctx.balance, ctx.oldestUnpaidDate) : "ok";
  const badge = status === "ok" ? null : PARTY_CREDIT_BADGE[status];
  return (
    <div className="erp-voucher-context" role="status">
      <span>{kind === "customer" ? "출고처" : "공급처"} <b>{partyName}</b></span>
      {ctx && (
        <>
          <span>{kind === "customer" ? "미수 잔액" : "미지급 잔액"} <b className={hasBalance ? "erp-u-danger" : undefined}>{formatNumber(ctx.balance)}</b></span>
          {badge && <GridBadge tone={badge.tone}>{badge.label}</GridBadge>}
          {ctx.lastOrderDate && <span>최근 거래 <b>{ctx.lastOrderDate}</b></span>}
          {ctx.paymentTerms && <span>결제조건 <b>{ctx.paymentTerms}</b></span>}
        </>
      )}
    </div>
  );
}
