"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { upsertCalendarNote } from "@/app/(dashboard)/dashboard/actions";
import { FormMessage } from "@/components/form-message";

type DayData = {
  salesCount: number;
  salesTotal: number;
  salesItems: { label: string; amount: number }[];
  purchaseCount: number;
  purchaseTotal: number;
  purchaseItems: { label: string; amount: number }[];
  note: string;
};

type Cell = { dateStr: string; day: number } | null;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function DashboardCalendar({
  year,
  month,
  weeks,
  dataByDate,
  todayStr,
  prevMonthHref,
  nextMonthHref,
}: {
  year: number;
  month: number;
  weeks: Cell[][];
  dataByDate: Record<string, DayData>;
  todayStr: string;
  prevMonthHref: string;
  nextMonthHref: string;
}) {
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            {year}년 {month}월
          </h2>
          <div className="flex gap-1">
            <Link
              href={prevMonthHref}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              ← 이전달
            </Link>
            <Link
              href={nextMonthHref}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              다음달 →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weeks.map((week, wi) =>
            week.map((cell, di) => {
              if (!cell) {
                return <div key={`${wi}-${di}`} className="aspect-square rounded-md" />;
              }
              const data = dataByDate[cell.dateStr];
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selected;
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelected(cell.dateStr)}
                  className={`aspect-square rounded-md border p-1 text-left text-xs transition-colors ${
                    isSelected
                      ? "border-gray-900 bg-gray-900 text-white"
                      : isToday
                        ? "border-gray-400 bg-gray-50 text-gray-900"
                        : "border-transparent text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div>{cell.day}</div>
                  <div className="mt-1 flex gap-0.5">
                    {data?.salesCount ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-green-500"}`}
                      />
                    ) : null}
                    {data?.purchaseCount ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-amber-500"}`}
                      />
                    ) : null}
                    {data?.note ? (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-gray-400"}`}
                      />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> 매출
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> 매입
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> 메모
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {selected ? (
          <>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">{selected}</h3>

            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-gray-500">
                매출 {selectedData.salesCount}건 · {selectedData.salesTotal.toLocaleString()}원
              </p>
              {selectedData.salesItems.length > 0 && (
                <ul className="space-y-0.5 text-xs text-gray-600">
                  {selectedData.salesItems.map((item, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      <span className="shrink-0">{item.amount.toLocaleString()}원</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mb-4">
              <p className="mb-1 text-xs font-medium text-gray-500">
                매입 {selectedData.purchaseCount}건 · {selectedData.purchaseTotal.toLocaleString()}원
              </p>
              {selectedData.purchaseItems.length > 0 && (
                <ul className="space-y-0.5 text-xs text-gray-600">
                  {selectedData.purchaseItems.map((item, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      <span className="shrink-0">{item.amount.toLocaleString()}원</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <NoteForm dateStr={selected} initialContent={selectedData.note} />
          </>
        ) : (
          <p className="text-sm text-gray-400">날짜를 선택해주세요.</p>
        )}
      </div>
    </div>
  );
}

function NoteForm({ dateStr, initialContent }: { dateStr: string; initialContent: string }) {
  const [state, formAction, pending] = useActionState(upsertCalendarNote, undefined);

  return (
    <form action={formAction} key={dateStr} className="space-y-2">
      <input type="hidden" name="note_date" value={dateStr} />
      <label className="block text-xs font-medium text-gray-500">메모</label>
      <textarea
        name="content"
        defaultValue={initialContent}
        rows={4}
        placeholder="이 날짜에 대한 메모를 남겨보세요"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {pending ? "저장 중..." : "메모 저장"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
