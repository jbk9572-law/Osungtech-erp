import type { ReactNode } from "react";
import Link from "next/link";

// 달력 화면(캘린더 페이지·대시보드 달력 위젯)이 같이 쓰는 조각 — 머리줄(제목+이전/다음달), 요일 줄, 범례, 날짜 숫자 색.
// 예전엔 두 화면이 같은 Tailwind 문자열을 복붙했다(개발헌법 3번) — 이제 .erp-cal-* 클래스 한 곳(erp-theme.css)에서 모양을 정한다.
export const CAL_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function CalendarNav({
  year,
  month,
  prevHref,
  nextHref,
  extra,
}: {
  year: number;
  month: number;
  prevHref: string;
  nextHref: string;
  /** 제목 옆 오른쪽에 끼울 컨트롤(예: 건수/자세히 전환) */
  extra?: ReactNode;
}) {
  return (
    <div className="erp-cal-nav">
      <h2 className="erp-cal-title">
        {year}년 {month}월
      </h2>
      <div className="erp-cal-nav-actions">
        {extra}
        <Link href={prevHref} className="erp-btn erp-btn-sm">
          ← 이전달
        </Link>
        <Link href={nextHref} className="erp-btn erp-btn-sm">
          다음달 →
        </Link>
      </div>
    </div>
  );
}

export function CalendarWeekdays() {
  return (
    <div className="erp-cal-weekdays">
      {CAL_WEEKDAYS.map((w, i) => (
        <span key={w} className={i === 0 ? "is-sun" : i === 6 ? "is-sat" : undefined}>
          {w}
        </span>
      ))}
    </div>
  );
}

/** 날짜 숫자의 클래스 — 공휴일·일요일은 빨강, 토요일은 파랑(선택된 칸은 CSS가 흰색으로). */
export function calDayClass(dayOfWeek: number, isHoliday: boolean): string {
  return `erp-cal-day${isHoliday ? " is-holiday" : dayOfWeek === 0 ? " is-sun" : dayOfWeek === 6 ? " is-sat" : ""}`;
}

export function CalendarLegend({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  return (
    <div className="erp-cal-legend">
      {items.map(([kind, label]) => (
        <span key={kind}>
          <span className={`erp-cal-dot is-${kind}`} /> {label}
        </span>
      ))}
    </div>
  );
}
