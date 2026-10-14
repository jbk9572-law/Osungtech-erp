"use client";

import { useMemo, useState } from "react";
import { ClickableRow } from "@/components/clickable-row";
import { formatNumber } from "@/lib/format-number";

export type BalanceRow = { id: string; name: string; total: number; paid: number; balance: number };

type SortKey = "name" | "total" | "paid" | "balance";

function compareValues(a: BalanceRow, b: BalanceRow, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av ?? "").localeCompare(String(bv ?? ""), "ko");
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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

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
      <div className="erp-field-grid">
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

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              {sortableHeader(partyLabel, "name")}
              {sortableHeader(totalLabel, "total", "num")}
              {sortableHeader(paidLabel, "paid", "num")}
              {sortableHeader("잔액", "balance", "num")}
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
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  상세 →
                </td>
              </ClickableRow>
            ))}
            {!sortedRows.length && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  {query.trim() ? "검색 결과가 없습니다." : emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
