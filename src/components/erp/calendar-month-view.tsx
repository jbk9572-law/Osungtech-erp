"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getHolidayName } from "@/lib/kr-holidays";
import { startRouteProgress } from "@/lib/route-progress";
import { copyText } from "@/lib/clipboard";
import { regenerateCalendarFeedToken } from "@/app/(dashboard)/calendar/actions";
import { PageGuide } from "@/components/erp/page-guide";
import { CalendarNav, CalendarWeekdays, CalendarLegend, calDayClass } from "@/components/erp/calendar-parts";
import type { CalendarItem } from "@/lib/calendar-data";

type Cell = { dateStr: string; day: number } | null;

const CAL_LEGEND = [
  ["meeting", "회의/일정"],
  ["leave", "연차"],
] as const;

export function CalendarMonthView({
  year,
  month,
  weeks,
  itemsByDate,
  todayStr,
  prevMonthHref,
  nextMonthHref,
  feedUrl,
  currentUserId,
  isAdmin,
}: {
  year: number;
  month: number;
  weeks: Cell[][];
  itemsByDate: Record<string, CalendarItem[]>;
  todayStr: string;
  prevMonthHref: string;
  nextMonthHref: string;
  feedUrl: string | null;
  currentUserId: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const defaultSelected =
    itemsByDate[todayStr] !== undefined || weeks.some((w) => w.some((c) => c?.dateStr === todayStr))
      ? todayStr
      : null;
  const [selected, setSelected] = useState<string | null>(defaultSelected);
  const [copied, setCopied] = useState(false);
  const [regenPending, setRegenPending] = useState(false);

  const selectedItems = (selected && itemsByDate[selected]) || [];

  function canEdit(item: CalendarItem) {
    return item.source === "meeting" && (item.createdBy === currentUserId || isAdmin);
  }

  async function handleCopyFeedUrl() {
    if (!feedUrl) return;
    await copyText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleRegenerate() {
    setRegenPending(true);
    try {
      await regenerateCalendarFeedToken();
      router.refresh();
    } finally {
      setRegenPending(false);
    }
  }

  return (
    <div className="erp-cal-layout">
      <div className="erp-cal-card">
        <CalendarNav year={year} month={month} prevHref={prevMonthHref} nextHref={nextMonthHref} />
        <CalendarWeekdays />
        <div className="erp-cal-grid">
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              if (!cell) {
                return <div key={`${wi}-${di}`} className="erp-cal-cell is-empty" />;
              }
              const items = itemsByDate[cell.dateStr] ?? [];
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selected;
              const holidayName = getHolidayName(cell.dateStr);
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  title={items.length ? items.map((i) => i.title).join(" · ") : undefined}
                  onClick={() => setSelected(cell.dateStr)}
                  className={`erp-cal-cell${isSelected ? " is-selected" : isToday ? " is-today" : ""}`}
                >
                  <div className={calDayClass(di, !!holidayName)}>{cell.day}</div>
                  {holidayName ? <div className="erp-cal-holiday">{holidayName}</div> : null}
                  <div className="erp-cal-rich">
                    {items.slice(0, 3).map((item) => (
                      <div key={item.id} className={`erp-cal-chip is-${item.source}`}>
                        {item.title}
                      </div>
                    ))}
                    {items.length > 3 ? <div className="erp-cal-more">외 {items.length - 3}건</div> : null}
                  </div>
                  <div className="erp-cal-dots">
                    {items.slice(0, 4).map((item) => (
                      <span key={item.id} className={`erp-cal-dot is-${item.source}`} />
                    ))}
                  </div>
                </button>
              );
            }),
          )}
        </div>
        <CalendarLegend items={CAL_LEGEND} />
      </div>

      <div className="erp-cal-side">
        <div className="erp-cal-card">
          <h3>{selected ?? "날짜를 선택하세요"}</h3>
          {selectedItems.length === 0 ? (
            <p className="erp-u-muted erp-u-text-sm">일정이 없습니다.</p>
          ) : (
            <ul className="erp-cal-event-list">
              {selectedItems.map((item) => (
                <li key={item.id} className={`erp-cal-event is-${item.source}`}>
                  <div className="erp-cal-event-head">
                    <span>{item.title}</span>
                    {canEdit(item) && (
                      <Link href={`/calendar/${item.rawId}/edit`} onClick={() => startRouteProgress()} className="erp-btn erp-btn-xs">
                        수정
                      </Link>
                    )}
                  </div>
                  {!item.allDay && (
                    <div className="erp-cal-event-meta">
                      {item.startAt.slice(11, 16)} ~ {item.endAt.slice(11, 16)}
                    </div>
                  )}
                  {item.location && <div className="erp-cal-event-meta">📍 {item.location}</div>}
                  {item.description && <div className="erp-cal-event-meta">{item.description}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="erp-cal-card">
          <h3>캘린더 구독</h3>
          <PageGuide>
            아래 URL을 구글/아웃룩/애플 캘린더의 &quot;URL로 캘린더 구독&quot;에 등록하면 이 화면의 일정이 그대로 반영됩니다.
          </PageGuide>
          {feedUrl ? (
            <>
              <input aria-label="캘린더 구독 주소" readOnly value={feedUrl} className="erp-input erp-u-w-full erp-u-mb-8" onFocus={(e) => e.currentTarget.select()} />
              <div className="erp-cal-nav-actions">
                <button type="button" onClick={handleCopyFeedUrl} className="erp-btn erp-btn-sm">
                  {copied ? "복사됨" : "URL 복사"}
                </button>
                <button type="button" onClick={handleRegenerate} disabled={regenPending} className="erp-btn erp-btn-sm">
                  {regenPending ? "재발급 중..." : "URL 재발급"}
                </button>
              </div>
            </>
          ) : (
            <p className="erp-u-muted erp-u-text-sm">로그인 후 이용할 수 있습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
