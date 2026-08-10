"use client";

import { useMemo, useState } from "react";
import { ClickableRow } from "@/components/clickable-row";

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
  partyLabel,
  totalLabel,
  paidLabel,
  emptyLabel,
}: {
  rows: BalanceRow[];
  hrefBase: string;
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
        <button
          type="button"
          onClick={() => toggleSort(key)}
          style={{ all: "unset", cursor: "pointer", userSelect: "none", display: "inline-flex", alignItems: "center" }}
        >
          {label}
          {sortIndicator(key)}
        </button>
      </th>
    );
  }

  return (
    <>
      <div className="erp-search">
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label>{partyLabel} 검색</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${partyLabel}으로 검색`}
            className="erp-input"
            style={{ width: "100%" }}
          />
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
              <ClickableRow key={b.id} href={`${hrefBase}/${b.id}`}>
                <td>{b.name}</td>
                <td className="num">{b.total.toLocaleString()}</td>
                <td className="num">{b.paid.toLocaleString()}</td>
                <td
                  className="num"
                  style={{ color: b.balance > 0 ? "var(--erp-danger)" : "var(--erp-text)", fontWeight: 700 }}
                >
                  {b.balance.toLocaleString()}
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
