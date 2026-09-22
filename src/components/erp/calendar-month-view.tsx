"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getHolidayName } from "@/lib/kr-holidays";
import { startRouteProgress } from "@/lib/route-progress";
import { copyText } from "@/lib/clipboard";
import { regenerateCalendarFeedToken } from "@/app/(dashboard)/calendar/actions";
import { PageGuide } from "@/components/erp/page-guide";
import type { CalendarItem } from "@/lib/calendar-data";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type Cell = { dateStr: string; day: number } | null;

const SOURCE_DOT: Record<CalendarItem["source"], string> = {
  meeting: "bg-[var(--erp-primary)]",
  leave: "bg-[var(--erp-warning)]",
};

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
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
      <div className="rounded-sm border border-[var(--erp-border)] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--erp-text)]">
            {year}년 {month}월
          </h2>
          <div className="flex gap-1">
            <Link
              href={prevMonthHref}
              className="rounded-sm border border-[var(--erp-border)] px-2 py-1 text-xs text-[var(--erp-text-muted)] hover:bg-[var(--erp-hover)]"
            >
              ← 이전달
            </Link>
            <Link
              href={nextMonthHref}
              className="rounded-sm border border-[var(--erp-border)] px-2 py-1 text-xs text-[var(--erp-text-muted)] hover:bg-[var(--erp-hover)]"
            >
              다음달 →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`py-1 ${i === 0 ? "text-[var(--erp-danger)]" : i === 6 ? "text-[var(--erp-primary)]" : "text-[var(--erp-text-muted)]"}`}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              if (!cell) {
                return <div key={`${wi}-${di}`} className="aspect-square rounded-sm" />;
              }
              const items = itemsByDate[cell.dateStr] ?? [];
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selected;
              const holidayName = getHolidayName(cell.dateStr);
              const isSunday = di === 0;
              const isSaturday = di === 6;
              const dayColorClass = isSelected
                ? "text-white"
                : holidayName
                  ? "text-[var(--erp-danger)] font-semibold"
                  : isSunday
                    ? "text-[var(--erp-danger)]"
                    : isSaturday
                      ? "text-[var(--erp-primary)]"
                      : "text-[var(--erp-text)]";
              const tooltipParts = items.map((i) => i.title);
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  title={tooltipParts.length ? tooltipParts.join(" · ") : undefined}
                  onClick={() => setSelected(cell.dateStr)}
                  className={`aspect-square rounded-sm border p-1 text-left text-xs transition-colors ${
                    isSelected
                      ? "border-[var(--erp-primary)] bg-[var(--erp-primary)] text-white"
                      : isToday
                        ? "border-[var(--erp-primary)] bg-[var(--erp-selected)]"
                        : "border-transparent hover:bg-[var(--erp-hover)]"
                  }`}
                >
                  <div className={dayColorClass}>{cell.day}</div>
                  {holidayName ? (
                    <div className={`truncate text-[9px] leading-tight ${isSelected ? "text-white" : "text-[var(--erp-danger)]"}`}>
                      {holidayName}
                    </div>
                  ) : null}
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {items.slice(0, 4).map((item) => (
                      <span
                        key={item.id}
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : SOURCE_DOT[item.source]}`}
                      />
                    ))}
                  </div>
                </button>
              );
            }),
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--erp-text-muted)]">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--erp-primary)]" /> 회의/일정
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--erp-warning)]" /> 연차
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-sm border border-[var(--erp-border)] bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-[var(--erp-text)]">
            {selected ?? "날짜를 선택하세요"}
          </h3>
          {selectedItems.length === 0 ? (
            <p className="text-xs text-[var(--erp-text-muted)]">일정이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {selectedItems.map((item) => (
                <li key={item.id} className="border-l-[3px] p-2 text-xs" style={{ borderLeftColor: item.source === "meeting" ? "var(--erp-primary)" : "var(--erp-warning)", background: "var(--erp-bg-subtle)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-[var(--erp-text)]">{item.title}</span>
                    {canEdit(item) && (
                      <Link
                        href={`/calendar/${item.rawId}/edit`}
                        onClick={() => startRouteProgress()}
                        className="shrink-0 text-[11px] text-[var(--erp-primary)] hover:underline"
                      >
                        수정
                      </Link>
                    )}
                  </div>
                  {!item.allDay && (
                    <div className="mt-1 text-[var(--erp-text-muted)]">
                      {item.startAt.slice(11, 16)} ~ {item.endAt.slice(11, 16)}
                    </div>
                  )}
                  {item.location && <div className="mt-1 text-[var(--erp-text-muted)]">📍 {item.location}</div>}
                  {item.description && <div className="mt-1 whitespace-pre-wrap text-[var(--erp-text-muted)]">{item.description}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-sm border border-[var(--erp-border)] bg-white p-4">
          <h3 className="mb-2 text-sm font-bold text-[var(--erp-text)]">캘린더 구독</h3>
          <PageGuide className="text-[11px]">
            아래 URL을 구글/아웃룩/애플 캘린더의 &quot;URL로 캘린더 구독&quot;에 등록하면 이 화면의 일정이 그대로 반영됩니다.
          </PageGuide>
          {feedUrl ? (
            <>
              <div className="mb-2 flex items-center gap-1">
                <input readOnly value={feedUrl} className="erp-input w-full" style={{ fontSize: 11 }} onFocus={(e) => e.currentTarget.select()} />
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={handleCopyFeedUrl} className="erp-btn" style={{ minWidth: 0 }}>
                  {copied ? "복사됨" : "URL 복사"}
                </button>
                <button type="button" onClick={handleRegenerate} disabled={regenPending} className="erp-btn" style={{ minWidth: 0 }}>
                  {regenPending ? "재발급 중..." : "URL 재발급"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-[var(--erp-text-muted)]">로그인 후 이용할 수 있습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
