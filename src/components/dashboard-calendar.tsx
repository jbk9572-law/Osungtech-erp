"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upsertCalendarNote } from "@/app/(dashboard)/dashboard/actions";
import { FormMessage } from "@/components/form-message";
import { getHolidayName } from "@/lib/kr-holidays";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

type ItemRow = {
  partnerName: string;
  productName: string;
  spec: string;
  unit: string;
  quantity: number;
  amount: number;
};

type DayData = {
  salesCount: number;
  salesTotal: number;
  salesItems: ItemRow[];
  purchaseCount: number;
  purchaseTotal: number;
  purchaseItems: ItemRow[];
  note: string;
};

type Cell = { dateStr: string; day: number } | null;

// 거래처별로 묶어서 보여주기 위한 그룹핑. 목록 안에서 같은 거래처가 여러 번
// 나와도 한 번만 묶어서 보여준다(처음 등장한 순서를 그대로 유지).
function groupByPartner(items: ItemRow[]) {
  const groups: { partnerName: string; items: ItemRow[] }[] = [];
  const index = new Map<string, number>();
  for (const item of items) {
    let i = index.get(item.partnerName);
    if (i === undefined) {
      i = groups.length;
      index.set(item.partnerName, i);
      groups.push({ partnerName: item.partnerName, items: [] });
    }
    groups[i].items.push(item);
  }
  return groups;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function DashboardCalendar({
  year,
  month,
  weeks,
  dataByDate,
  todayStr,
  prevMonthHref,
  nextMonthHref,
  backgroundLogoUrl,
  lowStockToday,
}: {
  year: number;
  month: number;
  weeks: Cell[][];
  dataByDate: Record<string, DayData>;
  todayStr: string;
  prevMonthHref: string;
  nextMonthHref: string;
  backgroundLogoUrl?: string | null;
  lowStockToday?: boolean;
}) {
  const router = useRouter();
  const defaultSelected = dataByDate[todayStr] !== undefined || weeks.some((w) => w.some((c) => c?.dateStr === todayStr))
    ? todayStr
    : null;
  const [selected, setSelected] = useState<string | null>(defaultSelected);

  const selectedData: DayData = (selected && dataByDate[selected]) || {
    salesCount: 0,
    salesTotal: 0,
    salesItems: [],
    purchaseCount: 0,
    purchaseTotal: 0,
    purchaseItems: [],
    note: "",
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
      <div className="relative overflow-hidden rounded-sm border border-[#d9d9d9] bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundLogoUrl || "/branding/logo-mark.png"}
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
        />
        <div className="relative mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#1c1c1c]">
            {year}년 {month}월
          </h2>
          <div className="flex gap-1">
            <Link
              href={prevMonthHref}
              className="rounded-sm border border-[#d9d9d9] px-2 py-1 text-xs text-[#6b7280] hover:bg-[#f3f7fc]"
            >
              ← 이전달
            </Link>
            <Link
              href={nextMonthHref}
              className="rounded-sm border border-[#d9d9d9] px-2 py-1 text-xs text-[#6b7280] hover:bg-[#f3f7fc]"
            >
              다음달 →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`py-1 ${i === 0 ? "text-[#dc3545]" : i === 6 ? "text-[#1f3b75]" : "text-[#9aa2ad]"}`}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="relative grid grid-cols-7 gap-1">
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              if (!cell) {
                return <div key={`${wi}-${di}`} className="aspect-square rounded-sm" />;
              }
              const data = dataByDate[cell.dateStr];
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selected;
              const holidayName = getHolidayName(cell.dateStr);
              const isSunday = di === 0;
              const isSaturday = di === 6;
              const dayColorClass = isSelected
                ? "text-white"
                : holidayName
                  ? "text-[#dc3545] font-semibold"
                  : isSunday
                    ? "text-[#dc3545]"
                    : isSaturday
                      ? "text-[#1f3b75]"
                      : "text-[#1c1c1c]";
              const showLowStockDot = isToday && lowStockToday;
              const tooltipParts = [
                data?.salesCount ? `매출 ${data.salesCount}건` : null,
                data?.purchaseCount ? `매입 ${data.purchaseCount}건` : null,
                data?.note ? "메모 있음" : null,
                showLowStockDot ? "안전재고 부족" : null,
              ].filter(Boolean);
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  title={tooltipParts.length ? tooltipParts.join(" · ") : undefined}
                  onClick={() => setSelected(cell.dateStr)}
                  onDoubleClick={() => router.push(`/sales?from=${cell.dateStr}&to=${cell.dateStr}`)}
                  className={`aspect-square rounded-sm border p-1 text-left text-xs transition-colors ${
                    isSelected
                      ? "border-[#1f3b75] bg-[#1f3b75] text-white"
                      : isToday
                        ? "border-[#1f3b75] bg-[#ddebff]"
                        : "border-transparent hover:bg-[#f3f7fc]"
                  }`}
                >
                  <div className={dayColorClass}>{cell.day}</div>
                  {holidayName ? (
                    <div
                      className={`truncate text-[9px] leading-tight ${isSelected ? "text-white" : "text-[#dc3545]"}`}
                    >
                      {holidayName}
                    </div>
                  ) : null}
                  <div className="mt-0.5 flex gap-0.5">
                    {data?.purchaseCount ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#28a745]"}`}
                      />
                    ) : null}
                    {data?.salesCount ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#1f3b75]"}`}
                      />
                    ) : null}
                    {data?.note ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#ff9800]"}`}
                      />
                    ) : null}
                    {showLowStockDot ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#dc3545]"}`}
                      />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#6b7280]">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#28a745]" /> 매입
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1f3b75]" /> 매출
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff9800]" /> 메모
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#dc3545]" /> 재고부족
          </span>
        </div>
      </div>

      <div className="rounded-sm border border-[#d9d9d9] bg-white p-4">
        {selected ? (
          <>
            <h3 className="mb-3 text-sm font-bold text-[#1c1c1c]">{selected} 오늘의 업무</h3>

            <div className="mb-3">
              <p className="mb-1 text-xs font-bold text-[#1f3b75]">
                매출 {selectedData.salesCount}건 · {selectedData.salesTotal.toLocaleString()}원
              </p>
              {selectedData.salesItems.length > 0 && (
                <div className="space-y-2 text-xs font-medium text-[#1f3b75]">
                  {groupByPartner(selectedData.salesItems).map((group, gi) => (
                    <div key={gi}>
                      <p className="truncate font-bold">- {group.partnerName}</p>
                      <ul className="space-y-1 pl-3 font-normal">
                        {group.items.map((item, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 truncate">
                              {item.productName}
                              {item.spec && <span className="text-[#8ea3c9]"> ({item.spec})</span>}
                              <span className="text-[#8ea3c9]">
                                {" "}
                                · {item.quantity.toLocaleString()}
                                {item.unit}
                              </span>
                            </span>
                            <span className="shrink-0">{item.amount.toLocaleString()}원</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4">
              <p className="mb-1 text-xs font-bold text-[#28a745]">
                매입 {selectedData.purchaseCount}건 · {selectedData.purchaseTotal.toLocaleString()}원
              </p>
              {selectedData.purchaseItems.length > 0 && (
                <div className="space-y-2 text-xs font-medium text-[#28a745]">
                  {groupByPartner(selectedData.purchaseItems).map((group, gi) => (
                    <div key={gi}>
                      <p className="truncate font-bold">- {group.partnerName}</p>
                      <ul className="space-y-1 pl-3 font-normal">
                        {group.items.map((item, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 truncate">
                              {item.productName}
                              {item.spec && <span className="text-[#8fcb9d]"> ({item.spec})</span>}
                              <span className="text-[#8fcb9d]">
                                {" "}
                                · {item.quantity.toLocaleString()}
                                {item.unit}
                              </span>
                            </span>
                            <span className="shrink-0">{item.amount.toLocaleString()}원</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <NoteForm dateStr={selected} initialContent={selectedData.note} />
          </>
        ) : (
          <p className="text-sm text-[#9aa2ad]">날짜를 선택해주세요.</p>
        )}
      </div>
    </div>
  );
}

function NoteForm({ dateStr, initialContent }: { dateStr: string; initialContent: string }) {
  const [state, formAction, pending] = useActionState(upsertCalendarNote, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} key={dateStr} className="space-y-2">
      <input type="hidden" name="note_date" value={dateStr} />
      <label className="block text-xs font-medium" style={{ color: "var(--erp-text-muted)" }}>
        메모
      </label>
      <textarea
        name="content"
        defaultValue={initialContent}
        rows={4}
        placeholder="이 날짜에 대한 메모를 남겨보세요"
        className="erp-input w-full"
        style={{ height: "auto" }}
      />
      <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          "F7 메모 저장"
        )}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
