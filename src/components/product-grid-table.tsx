"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { ClickableRow } from "@/components/clickable-row";
import type { FormState } from "@/components/form-message";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { bulkDeleteProducts } from "@/app/(dashboard)/products/actions";
import { formatQuantityWithBoxes } from "@/lib/package-qty";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { useSortableRows } from "@/lib/grid-sort";
import { SortableTh } from "@/components/grid/sortable-th";
import { stickyHeaderStyle, stickyCellStyle, GRID_CHECKBOX_WIDTH } from "@/lib/grid-sticky";
import { GridBadge } from "@/components/grid/badge";

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

// SKU/상품명 칸은 옆으로 스크롤해도 항상 보이게 고정한다 — 매출/매입
// 그리드와 동일한 패턴.
const STICKY_1_WIDTH = 90;
const STICKY_2_WIDTH = 160;

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
  const { sortedRows, toggleSort, sortIndicator, ariaSortFor } = useSortableRows<ProductGridRow, SortKey>(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(bulkDeleteProducts, undefined);

  // 일괄삭제 성공 시 선택/확인란을 비운다 — 다른 그리드들과 동일한 패턴.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setSelected(new Set());
      setConfirmText("");
    }
  }

  const allowBulkDelete = mode === "products";
  const selectedNames = sortedRows.filter((r) => selected.has(r.id)).map((r) => r.name);
  const namePreview =
    selectedNames.length > 3
      ? `${selectedNames.slice(0, 3).join(", ")} 외 ${selectedNames.length - 3}건`
      : selectedNames.join(", ");
  const allSelected = sortedRows.length > 0 && sortedRows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sortedRows.map((r) => r.id)));
    setConfirmText("");
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmText("");
  }

  function sortableHeader(label: string, key: SortKey, extraStyle?: CSSProperties, className?: string) {
    return (
      <SortableTh
        label={`${label}${sortIndicator(key)}`}
        ariaSortValue={ariaSortFor(key)}
        onClick={() => toggleSort(key)}
        style={extraStyle}
        className={className}
      />
    );
  }

  const checkboxOffset = allowBulkDelete ? GRID_CHECKBOX_WIDTH : 0;
  const thCheckbox = stickyHeaderStyle(0, GRID_CHECKBOX_WIDTH);
  const tdCheckbox = stickyCellStyle(0, GRID_CHECKBOX_WIDTH);
  const thSticky1 = stickyHeaderStyle(checkboxOffset, STICKY_1_WIDTH);
  const thSticky2 = stickyHeaderStyle(checkboxOffset + STICKY_1_WIDTH, STICKY_2_WIDTH, {
    borderRight: "1px solid var(--erp-border)",
  });
  const tdSticky1 = stickyCellStyle(checkboxOffset, STICKY_1_WIDTH);
  const tdSticky2 = stickyCellStyle(checkboxOffset + STICKY_1_WIDTH, STICKY_2_WIDTH, {
    borderRight: "1px solid var(--erp-border)",
  });

  // products 모드는 체크박스 칸이 하나 더 있고, inventory 모드는 대신
  // 재고수량/상태가 안전재고 한 칸 대신 두 칸이라 결과적으로 항상 12칸이다.
  const colCount = 12;

  return (
    <>
      {allowBulkDelete && selected.size > 0 && (
        <BulkDeleteBar
          formAction={formAction}
          pending={pending}
          state={state}
          selectedIds={[...selected]}
          namePreview={namePreview}
          warningText="상품 삭제는 되돌릴 수 없습니다. 매입/매출 이력이 있는 상품은 삭제되지 않습니다."
          confirmText={confirmText}
          onConfirmTextChange={setConfirmText}
        />
      )}
      <div className="erp-grid-wrap">
        <table className="erp-grid">
        <thead>
          <tr>
            {allowBulkDelete && (
              <th style={thCheckbox}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
              </th>
            )}
            {sortableHeader("SKU", "sku", thSticky1)}
            {sortableHeader("상품명", "name", thSticky2)}
            <th>규격</th>
            <th>단위</th>
            <th className="num">포장수량</th>
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
            const isRowSelected = selected.has(row.id);
            return (
              <ClickableRow key={row.id} href={href} className={isRowSelected ? "selected" : undefined}>
                {allowBulkDelete && (
                  <td style={tdCheckbox}>
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      onChange={() => toggleRow(row.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`${row.name} 선택`}
                    />
                  </td>
                )}
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
                    <td className="num">{formatQuantityWithBoxes(row.quantity, row.basePackageQty)}</td>
                    <td>
                      <GridBadge tone={isLow ? "danger" : "ok"}>{isLow ? "재주문 필요" : "정상"}</GridBadge>
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
    </>
  );
}
