"use client";

import Link from "next/link";
import { ClockInOutPanel } from "@/components/clock-in-out-panel";
import { clockIn, clockOut } from "@/app/(dashboard)/hr/actions";

// 메인 화면 "오늘 근태" — 내 출퇴근 버튼(근태 화면과 같은 동작)과 오늘 연차인 사람. 연차자는 이미 달력 데이터에 들어 있어 따로 조회하지 않는다.
export function DashboardAttendancePanel({
  clockInTime,
  clockOutTime,
  leaveToday,
}: {
  clockInTime: string | null;
  clockOutTime: string | null;
  // 오늘이 보고 있는 달이 아니면 연차 정보를 알 수 없어 null
  leaveToday: string[] | null;
}) {
  return (
    <div className="erp-home-panel">
      <div className="erp-home-panel-title">
        <span>오늘 근태</span>
        <Link href="/hr/attendance" className="erp-u-muted erp-u-text-caption">근태 화면 →</Link>
      </div>
      <div className="erp-u-pad-10-12">
        <ClockInOutPanel
          compact
          clockedIn={!!clockInTime}
          clockedOut={!!clockOutTime}
          clockInTime={clockInTime}
          clockOutTime={clockOutTime}
          clockInAction={clockIn}
          clockOutAction={clockOut}
        />
        {leaveToday && (
          <p className="erp-u-muted erp-u-text-caption erp-u-mt-8">
            {leaveToday.length ? `오늘 휴가: ${leaveToday.join(", ")}` : "오늘 휴가인 사람이 없습니다."}
          </p>
        )}
      </div>
    </div>
  );
}
