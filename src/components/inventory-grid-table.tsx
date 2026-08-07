"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ClickableRow } from "@/components/clickable-row";

export type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  spec: string | null;
  reorderPoint: number | null;
  quantity: number;
};

type SortKey = "sku" | "name" | "quantity";

function compareValues(a: InventoryRow, b: InventoryRow, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av ?? "").localeCompare(String(bv ?? ""), "ko");
}

// SKU/상품명 칸은 옆으로 스크롤해도 항상 보이게 고정한다 — 매출/매입
// 그리드와 동일한 패턴. 재고는 상품 마스터 데이터라 목록에서 통째로
// 지우는 일괄삭제는 넣지 않는다(품목 삭제는 /products에서 별도 처리).
const STICKY_1_WIDTH = 110;
const STICKY_2_WIDTH = 220;
const stickyBase: CSSProperties = { position: "sticky", zIndex: 1 };

export function InventoryGridTable({ rows, keyword }: { rows: InventoryRow[]; keyword?: string }) {
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
    return (
      <th
        className={className}
        style={{ cursor: "pointer", userSelect: "none", ...extraStyle }}
        onClick={() => toggleSort(key)}
      >
        {label}
        {sortIndicator(key)}
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

  return (
    <div className="erp-grid-wrap">
      <table className="erp-grid">
        <thead>
          <tr>
            {sortableHeader("SKU", "sku", thSticky1)}
            {sortableHeader("상품명", "name", thSticky2)}
            <th>규격</th>
            {sortableHeader("수량", "quantity", undefined, "num")}
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            // 안전재고(재주문 기준)를 실제로 설정해둔(0보다 큰) 품목만 부족
            // 판정한다 — 알림벨/대시보드(lib/notifications.ts)와 동일한 기준.
            const isLow = (row.reorderPoint ?? 0) > 0 && row.quantity <= (row.reorderPoint ?? 0);
            return (
              <ClickableRow key={row.id} href={`/inventory/${row.id}`}>
                <td style={tdSticky1}>{row.sku}</td>
                <td style={tdSticky2}>{row.name}</td>
                <td>{row.spec || "-"}</td>
                <td className="num">{row.quantity.toLocaleString()}</td>
                <td>
                  <span className={`erp-badge ${isLow ? "erp-badge-danger" : "erp-badge-success"}`}>
                    {isLow ? "재주문 필요" : "정상"}
                  </span>
                </td>
              </ClickableRow>
            );
          })}
          {!sortedRows.length && (
            <tr>
              <td colSpan={5} className="erp-grid-empty">
                {keyword ? "검색 결과가 없습니다." : "등록된 상품이 없습니다."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
