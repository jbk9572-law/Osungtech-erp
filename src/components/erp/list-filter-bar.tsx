"use client";

import { useRef, useState, type ReactNode } from "react";
import { ListToolbar, ToolbarKey } from "@/components/erp/list-toolbar";
import { useThemeFeatures } from "@/lib/erp-theme-features";
import { currentMonth, getMonthRange, shiftMonth, type DatePreset } from "@/lib/date-presets";

// 목록·보고서 공용 "조회 도구줄" — 어느 화면이든 한 줄, 같은 순서(개발헌법 3번):
//   [조회 F5] [작업 버튼…] | [도구…] | [◀ 기간 ▶] | 검색 칸
// 조회·기간·검색은 이 부품이 한 곳에서 정한다 — 화면은 값(기간·검색어·자리표시)과 버튼만 넘긴다.
// 폼은 비어 있는 <form id>이고 입력칸은 form="id" 속성으로 붙는다: 도구줄은 화면 위쪽 자리(포털)에 그려질 수 있어 DOM이 폼 밖에 놓이기 때문이다.
// 모던이 아니면(appChrome 없음) legacy(예전 칩+폼 줄)를 그대로 그린다 — 클래식은 동결.
export function ListFilterBar({
  formId,
  basePath,
  from,
  to,
  month,
  q,
  searchPlaceholder,
  actions,
  tools,
  presets = [],
  monthButtons = [],
  hidden,
  legacy,
  after,
  showReset,
}: {
  formId: string;
  basePath: string;
  /** 기간 조회(시작·종료일) 화면 — from/to를 주면 [◀ 기간 ▶] */
  from?: string;
  to?: string;
  /** 기준월(YYYY-MM) 화면 — month를 주면 [◀ 2026년 11월 ▶] */
  month?: string;
  q?: string;
  /** 주면 검색 칸을 그린다(조건이 검색뿐이거나 기간이 없는 화면은 생략 가능) */
  searchPlaceholder?: string;
  actions?: ReactNode;
  tools?: ReactNode;
  presets?: DatePreset[];
  monthButtons?: DatePreset[];
  /** 조회할 때 같이 보내야 하는 주소 값(보기 방식 view 등) */
  hidden?: Record<string, string>;
  legacy: ReactNode;
  /** 모던에서만 도구줄 바로 아래에 그리는 내용(보기 전환 탭 등) — 클래식은 legacy 안에 이미 들어 있다 */
  after?: ReactNode;
  showReset?: boolean;
}) {
  const { appChrome } = useThemeFeatures();
  if (!appChrome) return <>{legacy}</>;
  return (
    <>
      <form id={formId} method="get" action={basePath}>
        {Object.entries(hidden ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      </form>
      <ListToolbar
        actions={
          <>
            <button type="submit" form={formId} className="erp-btn erp-btn-primary erp-u-nowrap">
              조회 <ToolbarKey>F5</ToolbarKey>
            </button>
            {actions}
          </>
        }
        tools={tools}
        filters={
          <>
            {from && to && <PeriodControl formId={formId} basePath={basePath} from={from} to={to} presets={presets} monthButtons={monthButtons} showReset={!!showReset} />}
            {month && <MonthControl formId={formId} month={month} />}
            {searchPlaceholder && (
              <input
                type="text"
                name="q"
                form={formId}
                className="erp-input erp-fb-search"
                autoComplete="off"
                defaultValue={q ?? ""}
                placeholder={searchPlaceholder}
                aria-label="검색"
              />
            )}
          </>
        }
      />
      {after}
    </>
  );
}

function MonthControl({ formId, month }: { formId: string; month: string }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const ref = useRef<HTMLInputElement>(null);
  function go(m: string) {
    if (ref.current) ref.current.value = m;
    setOpen(false);
    (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
  }
  const label = `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
  const thisMonth = currentMonth();
  return (
    <span className="erp-fb-period">
      <input ref={ref} type="hidden" name="month" form={formId} defaultValue={month} />
      <button type="button" className="erp-btn erp-btn-sm erp-u-minw-0" aria-label="이전 달" onClick={() => go(shiftMonth(month, -1))}>
        ◀
      </button>
      <button type="button" className="erp-btn erp-fb-period-main" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="erp-fb-label">기준월</span>
        <b>{label}</b> ▾
      </button>
      <button type="button" className="erp-btn erp-btn-sm erp-u-minw-0" aria-label="다음 달" onClick={() => go(shiftMonth(month, 1))}>
        ▶
      </button>
      {open && (
        <>
          <div className="erp-fb-backdrop" onClick={() => setOpen(false)} aria-hidden />
          <div className="erp-fb-pop" role="dialog" aria-label="기준월 선택">
            <div className="erp-fb-pop-group">
              <b>빠른 선택</b>
              <button type="button" className={`erp-date-preset-btn${month === thisMonth ? " active" : ""}`} onClick={() => go(thisMonth)}>
                이번 달
              </button>
              <button type="button" className="erp-date-preset-btn" onClick={() => go(shiftMonth(thisMonth, -1))}>
                지난달
              </button>
            </div>
            <div className="erp-fb-pop-group">
              <b>
                <button type="button" className="erp-btn erp-btn-xs erp-u-minw-0" aria-label="이전 해" onClick={() => setYear((y) => y - 1)}>
                  ◀
                </button>{" "}
                {year}년{" "}
                <button type="button" className="erp-btn erp-btn-xs erp-u-minw-0" aria-label="다음 해" onClick={() => setYear((y) => y + 1)}>
                  ▶
                </button>
              </b>
              <div className="erp-fb-pop-months">
                {Array.from({ length: 12 }, (_, i) => {
                  const m = `${year}-${String(i + 1).padStart(2, "0")}`;
                  return (
                    <button key={m} type="button" className={`erp-date-preset-btn${m === month ? " active" : ""}`} onClick={() => go(m)}>
                      {i + 1}월
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </span>
  );
}

function monthOf(from: string, to: string): string | null {
  const m = from.slice(0, 7);
  const r = getMonthRange(m);
  return r.from === from && r.to === to ? m : null;
}

function PeriodControl({
  formId,
  basePath,
  from,
  to,
  presets,
  monthButtons,
  showReset,
}: {
  formId: string;
  basePath: string;
  from: string;
  to: string;
  presets: DatePreset[];
  monthButtons: DatePreset[];
  showReset: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const month = monthOf(from, to);

  function go(f: string, t: string) {
    if (fromRef.current) fromRef.current.value = f;
    if (toRef.current) toRef.current.value = t;
    setOpen(false);
    (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
  }
  function shift(delta: number) {
    const r = getMonthRange(shiftMonth(month ?? from.slice(0, 7), delta));
    go(r.from, r.to);
  }
  const label = month ? `${month.slice(0, 4)}년 ${Number(month.slice(5))}월` : `${from.slice(5)} ~ ${to.slice(5)}`;

  return (
    <span className="erp-fb-period">
      <input ref={fromRef} type="hidden" name="from" form={formId} defaultValue={from} />
      <input ref={toRef} type="hidden" name="to" form={formId} defaultValue={to} />
      <button type="button" className="erp-btn erp-btn-sm erp-u-minw-0" aria-label="이전 달" onClick={() => shift(-1)}>
        ◀
      </button>
      <button type="button" className="erp-btn erp-fb-period-main" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="erp-fb-label">기간</span>
        <b>{label}</b> ▾
      </button>
      <button type="button" className="erp-btn erp-btn-sm erp-u-minw-0" aria-label="다음 달" onClick={() => shift(1)}>
        ▶
      </button>
      {open && (
        <>
          <div className="erp-fb-backdrop" onClick={() => setOpen(false)} aria-hidden />
          <div className="erp-fb-pop" role="dialog" aria-label="기간 선택">
            <div className="erp-fb-pop-group">
              <b>빠른 선택</b>
              {presets.map((p) => (
                <button key={p.label} type="button" className={`erp-date-preset-btn${from === p.from && to === p.to ? " active" : ""}`} onClick={() => go(p.from, p.to)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="erp-fb-pop-group">
              <b>월 바로 선택</b>
              <div className="erp-fb-pop-months">
                {monthButtons.map((p) => (
                  <button key={p.label} type="button" className={`erp-date-preset-btn${from === p.from && to === p.to ? " active" : ""}`} onClick={() => go(p.from, p.to)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="erp-fb-pop-group">
              <b>직접 지정</b>
              <span className="erp-fb-pop-range">
                <input type="date" className="erp-input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} aria-label="시작일" />
                ~
                <input type="date" className="erp-input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} aria-label="종료일" />
                <button type="button" className="erp-btn erp-btn-primary erp-btn-sm" onClick={() => customFrom && customTo && go(customFrom, customTo)}>
                  적용
                </button>
              </span>
            </div>
            {showReset && (
              <div className="erp-fb-pop-group">
                <a href={basePath} className="erp-btn erp-btn-sm">
                  조건 초기화
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
}
