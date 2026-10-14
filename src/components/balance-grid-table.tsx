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
  rowHref,
  partyLabel,
  totalLabel,
  paidLabel,
  emptyLabel,
}: {
  rows: BalanceRow[];
  // 대부분 화면은 상세가 `${고정 경로}/${id}` 형태라 hrefBase 문자열
  // 하나로 충분했지만, 하청업체 상세는 별도 라우트가 아니라
  // /subcontractors?id= 쿼리 파라미터라 고정 접두사로는 표현이 안 됐다
  // — 콜백으로 바꿔 어떤 URL 모양이든 이 공용 테이블을 그대로 쓸 수 있게 했다.
  rowHref: (id: string) => string;
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
