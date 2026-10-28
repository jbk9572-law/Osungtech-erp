"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import { formatNumber } from "@/lib/format-number";
import { GridBadge } from "@/components/grid/badge";

export type BalanceRow = {
  id: string;
  name: string;
  total: number;
  paid: number;
  balance: number;
  // 가장 오래된 미결제 전표 기준 경과일수 — 서버(daysSince, KST 기준)에서
  // 미리 계산해 내려준다("use client" 컴포넌트는 서버 타임존 헬퍼를 쓰지
  // 않는다는 관례, kst-date.ts 참고). 이 필드를 안 주는 화면(지급현황/
  // 외주비정산 — 아직 거래처 데이터만 있음)은 연체 열/필터 자체가 안 보인다.
  daysOverdue?: number | null;
};

type Filter = "all" | "overdue" | "30" | "90";

type SortKey = "name" | "total" | "paid" | "balance";

function compareValues(a: BalanceRow, b: BalanceRow, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av ?? "").localeCompare(String(bv ?? ""), "ko");
}

const AGING_FILTER_OPTIONS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "overdue", label: "연체만" },
  { key: "30", label: "30일+" },
  { key: "90", label: "90일+" },
];

function agingBadge(days: number | null | undefined): { tone: "ok" | "warn" | "danger"; label: string } {
  if (!days || days <= 0) return { tone: "ok", label: "정상" };
  if (days < 90) return { tone: "warn", label: `D+${days} 연체` };
  return { tone: "danger", label: `D+${days} 연체` };
}

export function BalanceGridTable({
  rows,
  hrefBase,
  hrefQueryParam,
  partyLabel,
  totalLabel,
  paidLabel,
  emptyLabel,
}: {
  rows: BalanceRow[];
  hrefBase: string;
  // 대부분 화면은 상세가 `${hrefBase}/${id}` 경로 형태라 생략하면 되지만,
  // 하청업체 상세는 별도 라우트가 아니라 /subcontractors?id= 쿼리
  // 파라미터라 이 값을 주면 `${hrefBase}?${hrefQueryParam}=${id}`로 만든다.
  // (함수 prop으로 뒀던 적이 있는데, 이 컴포넌트가 "use client"라 서버
  // 컴포넌트에서 함수를 그대로 내려줄 수 없어 런타임 에러가 났다 —
  // 직렬화 가능한 문자열 두 개로 되돌렸다.)
  hrefQueryParam?: string;
  partyLabel: string;
  totalLabel: string;
  paidLabel: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>({ key: "balance", dir: -1 });
  const [agingFilter, setAgingFilter] = useState<Filter>("all");

  // daysOverdue를 넘겨주는 화면(미수금현황)에서만 연체 열/필터를 보여준다.
  const showAging = rows.some((r) => r.daysOverdue !== undefined);

  const agingFilteredRows = useMemo(() => {
    if (!showAging || agingFilter === "all") return rows;
    return rows.filter((r) => {
      const d = r.daysOverdue ?? 0;
      if (agingFilter === "overdue") return d > 0;
      if (agingFilter === "30") return d >= 30;
      return d >= 90;
    });
  }, [rows, showAging, agingFilter]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? agingFilteredRows.filter((r) => r.name.toLowerCase().includes(q)) : agingFilteredRows;
  }, [agingFilteredRows, query]);

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    return [...filteredRows].sort((a, b) => compareValues(a, b, sort.key) * sort.dir);
  }, [filteredRows, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 1 };
      if (prev.dir === 1) return { key, dir: -1 };
      return null;
    });
  }

  function sortIndicator(key: SortKey) {
    if (!sort || sort.key !== key) return "";
    return sort.dir === 1 ? " ▲" : " ▼";
  }

  function rowHref(id: string): string {
    return hrefQueryParam ? `${hrefBase}?${hrefQueryParam}=${id}` : `${hrefBase}/${id}`;
  }

  function sortableHeader(label: string, key: SortKey, className?: string) {
    const isSorted = sort?.key === key;
    return (
      <th className={className} aria-sort={isSorted ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(key)} className="erp-th-btn">
          {label}
          {sortIndicator(key)}
        </button>
      </th>
    );
  }

  return (
    <>
      <div className="erp-field-grid" style={{ marginBottom: "var(--erp-space-4)" }}>
        <div className="erp-field erp-span-6">
          <label htmlFor="balance-search-q">{partyLabel} 검색</label>
          <input
            id="balance-search-q"
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${partyLabel}으로 검색`}
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <div
          className="erp-field erp-span-6"
          style={{ alignItems: "flex-end", flexDirection: "row", justifyContent: "flex-end" }}
        >
          <span style={{ fontSize: 12, color: "var(--erp-text-muted)", height: 30, display: "flex", alignItems: "center" }}>
            총 {sortedRows.length}건
            {query.trim() && rows.length !== sortedRows.length ? ` (전체 ${rows.length}건 중 검색됨)` : ""}
          </span>
        </div>
      </div>

      {showAging && (
        <div className="erp-date-presets" style={{ marginBottom: 8 }}>
          {AGING_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setAgingFilter(opt.key)}
              className={`erp-date-preset-btn${agingFilter === opt.key ? " active" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="erp-grid-wrap has-card-view">
        <table className="erp-grid">
          <thead>
            <tr>
              {sortableHeader(partyLabel, "name")}
              {sortableHeader(totalLabel, "total", "num")}
              {sortableHeader(paidLabel, "paid", "num")}
              {sortableHeader("잔액", "balance", "num")}
              {showAging && <th>연체</th>}
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((b) => (
              <ClickableRow key={b.id} href={rowHref(b.id)}>
                <td>{b.name}</td>
                <td className="num">{formatNumber(b.total)}</td>
                <td className="num">{formatNumber(b.paid)}</td>
                <td
                  className="num"
                  style={{ color: b.balance > 0 ? "var(--erp-danger)" : "var(--erp-text)", fontWeight: 700 }}
                >
                  {formatNumber(b.balance)}
                </td>
                {showAging && (
                  <td>
                    {(() => {
                      const { tone, label } = agingBadge(b.daysOverdue);
                      return <GridBadge tone={tone}>{label}</GridBadge>;
                    })()}
                  </td>
                )}
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  상세 →
                </td>
              </ClickableRow>
            ))}
            {!sortedRows.length && (
              <tr>
                <td colSpan={showAging ? 6 : 5} className="erp-grid-empty">
                  {query.trim() ? "검색 결과가 없습니다." : emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="erp-row-card-list">
        {sortedRows.map((b) => {
          const { tone, label } = agingBadge(b.daysOverdue);
          return (
            <Link key={b.id} href={rowHref(b.id)} className="erp-row-card">
              <div className="erp-row-card-head">
                <span className="erp-row-card-partner">{b.name}</span>
                {showAging && <GridBadge tone={tone}>{label}</GridBadge>}
              </div>
              <dl className="erp-order-item-fields">
                <div>
                  <dt>{totalLabel}</dt>
                  <dd>{formatNumber(b.total)}</dd>
                </div>
                <div>
                  <dt>{paidLabel}</dt>
                  <dd>{formatNumber(b.paid)}</dd>
                </div>
              </dl>
              <div className="erp-row-card-foot">
                <span style={{ color: "var(--erp-text-muted)" }}>잔액</span>
                <span
                  className="erp-row-card-amount"
                  style={{ color: b.balance > 0 ? "var(--erp-danger)" : "var(--erp-text)" }}
                >
                  {formatNumber(b.balance)}
                </span>
              </div>
            </Link>
          );
        })}
        {!sortedRows.length && (
          <p className="erp-grid-empty">{query.trim() ? "검색 결과가 없습니다." : emptyLabel}</p>
        )}
      </div>
    </>
  );
}
