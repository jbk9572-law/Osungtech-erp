"use client";

import { useActionState, useMemo, useState, type CSSProperties } from "react";
import { ClickableRow } from "@/components/clickable-row";
import { FormMessage, type FormState } from "@/components/form-message";
import { bulkDeletePurchases } from "@/app/(dashboard)/purchases/actions";

export type PurchaseRow = {
  key: string;
  orderId: string | undefined;
  date: string | undefined;
  supplierName: string | undefined;
  authorName: string | null | undefined;
  productLabel: string;
  spec: string;
  quantity: number;
  unit: string | null | undefined;
  unitCost: number | null;
  supplyAmount: number;
  taxAmount: number;
};

type SortKey = "date" | "supplierName" | "authorName" | "quantity" | "supplyAmount" | "taxAmount";

function compareValues(a: PurchaseRow, b: PurchaseRow, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av ?? "").localeCompare(String(bv ?? ""), "ko");
}

// 첫 두 칸(체크박스/매입일자)은 옆으로 스크롤해도 항상 보이게 고정한다 —
// 매출관리 그리드와 동일한 패턴.
const STICKY_1_WIDTH = 32;
const STICKY_2_WIDTH = 92;
const stickyBase: CSSProperties = { position: "sticky", zIndex: 1 };

export function PurchaseGridTable({
  rows,
  totalQuantity,
  totalSupply,
  totalTax,
  backParam,
}: {
  rows: PurchaseRow[];
  totalQuantity: number;
  totalSupply: number;
  totalTax: number;
  backParam: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState<FormState, FormData>(bulkDeletePurchases, undefined);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) setSelected(new Set());
  }

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

  const selectableIds = useMemo(
    () => sortedRows.map((r) => r.orderId).filter((id): id is string => !!id),
    [sortedRows]
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    <>
      {selected.size > 0 && (
        <form
          action={formAction}
          className="mb-2 flex flex-wrap items-center gap-2 rounded-sm border p-2 text-sm"
          style={{ borderColor: "var(--erp-border)", background: "var(--erp-selected)" }}
        >
          <input type="hidden" name="ids" value={JSON.stringify([...selected])} />
          <span style={{ fontWeight: 600 }}>{selected.size}건 선택됨</span>
          <button
            type="submit"
            disabled={pending}
            className="erp-btn erp-btn-danger"
            style={{ minWidth: 0 }}
            onClick={(e) => {
              if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까? 재고 수량이 자동으로 되돌아갑니다.`)) {
                e.preventDefault();
              }
            }}
          >
            {pending ? "삭제 중..." : "선택 삭제"}
          </button>
          <FormMessage state={state} />
        </form>
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={thSticky1}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
              </th>
              {sortableHeader("매입일자", "date", thSticky2)}
              {sortableHeader("공급처", "supplierName")}
              {sortableHeader("작성자", "authorName")}
              <th>품목명</th>
              <th>규격</th>
              {sortableHeader("수량", "quantity", undefined, "num")}
              <th className="num">매입가</th>
              {sortableHeader("공급가액", "supplyAmount", undefined, "num")}
              {sortableHeader("세액", "taxAmount", undefined, "num")}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const isRowSelected = !!row.orderId && selected.has(row.orderId);
              return (
                <ClickableRow
                  key={row.key}
                  href={row.orderId ? `/purchases/${row.orderId}${backParam ? `?back=${backParam}` : ""}` : "#"}
                  className={isRowSelected ? "selected" : undefined}
                >
                  <td style={tdSticky1}>
                    {row.orderId && (
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={() => toggleRow(row.orderId!)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </td>
                  <td style={tdSticky2}>{row.date ? new Date(row.date).toLocaleDateString("ko-KR") : "-"}</td>
                  <td>{row.supplierName}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.authorName ?? "-"}</td>
                  <td>{row.productLabel}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.spec}</td>
                  <td className="num">
                    {row.quantity.toLocaleString()} {row.unit}
                  </td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {row.unitCost != null ? row.unitCost.toLocaleString() : "-"}
                  </td>
                  <td className="num">{row.supplyAmount.toLocaleString()}</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {row.taxAmount.toLocaleString()}
                  </td>
                </ClickableRow>
              );
            })}
            {!sortedRows.length && (
              <tr>
                <td colSpan={10} className="erp-grid-empty">
                  조건에 맞는 매입 거래가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {sortedRows.length > 0 && (
            <tfoot>
              <tr style={{ background: "#eef1f5", fontWeight: 700 }}>
                <td colSpan={2} style={{ ...stickyBase, left: 0, background: "#eef1f5" }} />
                <td
                  colSpan={4}
                  style={{ ...stickyBase, left: STICKY_1_WIDTH + STICKY_2_WIDTH, background: "#eef1f5" }}
                >
                  합계 ({sortedRows.length}건)
                </td>
                <td className="num">{totalQuantity.toLocaleString()}</td>
                <td />
                <td className="num">{totalSupply.toLocaleString()}</td>
                <td className="num">{totalTax.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
