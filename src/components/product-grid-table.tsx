"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ClickableRow } from "@/components/clickable-row";

export type ProductGridRow = {
  id: string;
  sku: string;
  name: string;
  spec: string | null;
  unit: string | null;
  basePackageQty: number | null;
  categoryName: string | null;
  supplierName: string | null;
  cost: number | null;
  price: number | null;
  reorderPoint: number | null;
  quantity: number;
};

type SortKey = "sku" | "name" | "cost" | "price" | "reorderPoint" | "quantity";

function compareValues(a: ProductGridRow, b: ProductGridRow, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av ?? "").localeCompare(String(bv ?? ""), "ko");
}

// 판매가/매입가/안전재고를 0으로 등록해두는 경우는 실질적으로 없고("아직
// 안 정했다"는 뜻으로 쓰이므로), 목록에 "0"이 그대로 찍히면 진짜 0원/0개인
// 것과 구분이 안 된다. 0이면 "-"로 보여준다.
function formatNumOrDash(n: number | null | undefined) {
  return n ? Number(n).toLocaleString() : "-";
}

// SKU/상품명 칸은 옆으로 스크롤해도 항상 보이게 고정한다 — 매출/매입
// 그리드와 동일한 패턴.
const STICKY_1_WIDTH = 90;
const STICKY_2_WIDTH = 160;
const stickyBase: CSSProperties = { position: "sticky", zIndex: 1 };

export function ProductGridTable({
  rows,
  mode,
  backParam,
  keyword,
}: {
  rows: ProductGridRow[];
  mode: "products" | "inventory";
  backParam?: string;
  keyword?: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => compareValues(a, b, sort.key) * sort.dir);
  }, [rows, sort]);

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

  function sortableHeader(label: string, key: SortKey, extraStyle?: CSSProperties, className?: string) {
    const isSorted = sort?.key === key;
    return (
      <th
        className={className}
        style={extraStyle}
        aria-sort={isSorted ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}
      >
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

  const thSticky1: CSSProperties = { ...stickyBase, left: 0, width: STICKY_1_WIDTH, background: "#eef1f5", zIndex: 2 };
  const thSticky2: CSSProperties = {
    ...stickyBase,
    left: STICKY_1_WIDTH,
    width: STICKY_2_WIDTH,
    background: "#eef1f5",
    zIndex: 2,
    borderRight: "1px solid var(--erp-border)",
  };
  const tdSticky1: CSSProperties = { ...stickyBase, left: 0, width: STICKY_1_WIDTH, background: "#fff" };
  const tdSticky2: CSSProperties = {
    ...stickyBase,
    left: STICKY_1_WIDTH,
    width: STICKY_2_WIDTH,
    background: "#fff",
    borderRight: "1px solid var(--erp-border)",
  };

  const colCount = mode === "inventory" ? 11 : 11;

  return (
    <div className="erp-grid-wrap">
      <table className="erp-grid">
        <thead>
          <tr>
            {sortableHeader("SKU", "sku", thSticky1)}
            {sortableHeader("상품명", "name", thSticky2)}
            <th>규격</th>
            <th>단위</th>
            <th>포장수량</th>
            <th>카테고리</th>
            <th>공급처</th>
            {sortableHeader("매입가", "cost", undefined, "num")}
            {sortableHeader("판매가", "price", undefined, "num")}
            {mode === "products" ? (
              sortableHeader("안전재고", "reorderPoint", undefined, "num")
            ) : (
              <>
                {sortableHeader("재고수량", "quantity", undefined, "num")}
                <th>상태</th>
              </>
            )}
            <th />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const isLow = mode === "inventory" && (row.reorderPoint ?? 0) > 0 && row.quantity <= (row.reorderPoint ?? 0);
            const href =
              mode === "products"
                ? `/products/${row.id}${backParam ? `?back=${backParam}` : ""}`
                : `/inventory/${row.id}`;
            return (
              <ClickableRow key={row.id} href={href}>
                <td style={tdSticky1}>{row.sku}</td>
                <td style={tdSticky2}>{row.name}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.spec ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.unit ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>
                  {row.basePackageQty ? `1박스 = ${Number(row.basePackageQty).toLocaleString()}${row.unit ?? ""}` : "-"}
                </td>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.categoryName ?? "-"}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{row.supplierName ?? "-"}</td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {formatNumOrDash(row.cost)}
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {formatNumOrDash(row.price)}
                </td>
                {mode === "products" ? (
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {formatNumOrDash(row.reorderPoint)}
                  </td>
                ) : (
                  <>
                    <td className="num">{row.quantity.toLocaleString()}</td>
                    <td>
                      <span className={`erp-badge ${isLow ? "erp-badge-danger" : "erp-badge-success"}`}>
                        {isLow ? "재주문 필요" : "정상"}
                      </span>
                    </td>
                  </>
                )}
                <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                  {mode === "products" ? "수정 →" : ""}
                </td>
              </ClickableRow>
            );
          })}
          {!sortedRows.length && (
            <tr>
              <td colSpan={colCount} className="erp-grid-empty">
                {keyword ? "검색 결과가 없습니다." : "등록된 상품이 없습니다."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
