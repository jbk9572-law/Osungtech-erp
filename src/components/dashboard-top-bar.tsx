"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ClockButton } from "@/components/clock-in-out-panel";
import { FormMessage } from "@/components/form-message";
import { GuardedLink } from "@/components/erp/guarded-link";
import { QuickStockLookup, type StockLookupProduct } from "@/components/quick-stock-lookup";
import { clockIn, clockOut } from "@/app/(dashboard)/hr/actions";

// 메인 화면 맨 윗줄 — 하루에 몇 번씩 쓰는 것(출근·퇴근, 빠른 실행, 재고 조회)을 위젯 자리 없이 늘 같은 곳에 둔다.
// 좁은 화면에서도 보이도록 위젯 편집 줄과 따로 그리고, 칸이 모자라면 줄이 바뀐다.
export type TopBarClock = { clockInTime: string | null; clockOutTime: string | null };

function ClockBar({ clockInTime, clockOutTime }: TopBarClock) {
  const [inState, inAction] = useActionState(clockIn, undefined);
  const [outState, outAction] = useActionState(clockOut, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const accRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);

  if (clockOutTime) {
    return <span className="erp-dash-clock-done">출근 {clockInTime} · 퇴근 {clockOutTime}</span>;
  }
  const comingIn = !clockInTime;
  return (
    <form ref={formRef} action={comingIn ? inAction : outAction} className="erp-dash-clock">
      <input ref={latRef} type="hidden" name="lat" />
      <input ref={lngRef} type="hidden" name="lng" />
      <input ref={accRef} type="hidden" name="accuracy_m" />
      <span className="erp-dash-clock-label">{comingIn ? "출근 전" : `출근 ${clockInTime}`}</span>
      <ClockButton
        label={comingIn ? "출근하기" : "퇴근하기"}
        pendingLabel={locating ? "위치 확인 중..." : "처리 중..."}
        disabled={false}
        formRef={formRef}
        latRef={latRef}
        lngRef={lngRef}
        accuracyRef={accRef}
        onLocating={setLocating}
        className={`erp-btn erp-btn-sm ${comingIn ? "erp-btn-primary" : "erp-btn-dark"}`}
      />
      <FormMessage state={comingIn ? inState : outState} />
    </form>
  );
}

export function DashboardTopBar({
  clock,
  showReceivables,
  products,
}: {
  // 인사관리·근태를 끈 회사는 null — 출근 버튼을 그리지 않는다.
  clock: TopBarClock | null;
  showReceivables: boolean;
  products: StockLookupProduct[];
}) {
  return (
    <div className="erp-dash-topbar">
      {clock && <ClockBar clockInTime={clock.clockInTime} clockOutTime={clock.clockOutTime} />}
      <div className="erp-dash-actions">
        <GuardedLink className="erp-btn erp-btn-sm" href="/sales/new">새 판매</GuardedLink>
        <GuardedLink className="erp-btn erp-btn-sm" href="/purchases/new">새 입고</GuardedLink>
        <Link className="erp-btn erp-btn-sm" href="/products">품목 등록</Link>
        {showReceivables && <Link className="erp-btn erp-btn-sm" href="/receivables">미수금 현황</Link>}
      </div>
      <QuickStockLookup compact products={products} />
    </div>
  );
}
