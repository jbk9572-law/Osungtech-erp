"use client";

import { useActionState, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import type { FormState } from "@/components/form-message";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { bulkDeleteSales } from "@/app/(dashboard)/sales/actions";
import { useSortableRows } from "@/lib/grid-sort";
import { SortableTh } from "@/components/grid/sortable-th";
import { stickyHeaderStyle, stickyCellStyle, stickyFooterStyle, GRID_CHECKBOX_WIDTH } from "@/lib/grid-sticky";
import { GridBadge } from "@/components/grid/badge";

export type SalesRow = {
  key: string;
  kind: "sale" | "collection";
  orderId: string | undefined;
  customerId?: string;
  date: string | undefined;
  customerName: string | undefined;
  authorName: string | null | undefined;
  productLabel: string;
  spec: string;
  lotNumber?: string | null;
  remark?: string | null;
  quantity: number;
  unit: string | null | undefined;
  unitPrice: number | null;
  supplyAmount: number;
  taxAmount: number;
  deliveryMethod?: string | null;
};

type SortKey = "date" | "customerName" | "authorName" | "quantity" | "supplyAmount" | "taxAmount";

// 거래일자 칸(체크박스 다음)은 옆으로 스크롤해도 항상 보이게 고정한다 —
// 오른쪽 숫자 칸들을 보다가도 이게 어느 날짜 건인지 놓치지 않게.
const STICKY_2_WIDTH = 92;

export function SalesGridTable({
  rows,
  totalQuantity,
  totalSupply,
  totalTax,
  backParam,
}: {
  rows: SalesRow[];
  totalQuantity: number;
  totalSupply: number;
  totalTax: number;
  backParam: string;
}) {
  const { sortedRows, toggleSort, sortIndicator, ariaSortFor } = useSortableRows<SalesRow, SortKey>(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(bulkDeleteSales, undefined);

  // 일괄삭제 성공 시 선택을 비운다 — state 객체 identity가 바뀌었는지로
  // 판단(이 세션 다른 폼들과 동일한 패턴).
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setSelected(new Set());
      setConfirmText("");
    }
  }

  const selectedNames = useMemo(() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const row of sortedRows) {
      if (row.orderId && selected.has(row.orderId) && row.customerName && !seen.has(row.orderId)) {
        seen.add(row.orderId);
        names.push(row.customerName);
      }
    }
    return names;
  }, [sortedRows, selected]);
  const namePreview =
    selectedNames.length > 3
      ? `${selectedNames.slice(0, 3).join(", ")} 외 ${selectedNames.length - 3}건`
      : selectedNames.join(", ");

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
      <SortableTh
        label={`${label}${sortIndicator(key)}`}
        ariaSortValue={ariaSortFor(key)}
        onClick={() => toggleSort(key)}
        style={extraStyle}
        className={className}
      />
    );
  }

  const thSticky1 = stickyHeaderStyle(0, GRID_CHECKBOX_WIDTH);
  const thSticky2 = stickyHeaderStyle(GRID_CHECKBOX_WIDTH, STICKY_2_WIDTH, {
    borderRight: "1px solid var(--erp-border)",
  });
  const tdSticky1 = stickyCellStyle(0, GRID_CHECKBOX_WIDTH);
  const tdSticky2 = stickyCellStyle(GRID_CHECKBOX_WIDTH, STICKY_2_WIDTH, {
    borderRight: "1px solid var(--erp-border)",
  });

  return (
    <>
      {selected.size > 0 && (
        <BulkDeleteBar
          formAction={formAction}
          pending={pending}
          state={state}
          selectedIds={[...selected]}
          namePreview={namePreview}
          warningText="선택한 매출 건을 삭제하면 재고 수량이 자동으로 되돌아갑니다. 되돌릴 수 없습니다."
          confirmText={confirmText}
          onConfirmTextChange={setConfirmText}
        />
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={thSticky1}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
              </th>
              {sortableHeader("거래일자", "date", thSticky2)}
              <th style={{ width: 64 }}>유형</th>
              {sortableHeader("출고처", "customerName")}
              <th style={{ width: 76 }}>배송방법</th>
              {sortableHeader("작성자", "authorName")}
              <th>품목명 / 적요</th>
              <th>규격</th>
              <th>관리번호</th>
              {sortableHeader("수량", "quantity", undefined, "num")}
              <th className="num">공급가</th>
              {sortableHeader("공급가액", "supplyAmount", undefined, "num")}
              {sortableHeader("세액", "taxAmount", undefined, "num")}
              <th>비고</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const isRowSelected = !!row.orderId && selected.has(row.orderId);
              const isCollection = row.kind === "collection";
              const href = row.orderId
                ? `/sales/${row.orderId}${backParam ? `?back=${backParam}` : ""}`
                : row.customerId
                  ? `/customers/${row.customerId}`
                  : "#";
              return (
                <ClickableRow key={row.key} href={href} className={isRowSelected ? "selected" : undefined}>
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
                  <td>
                    <GridBadge tone={isCollection ? "warn" : "info"}>{isCollection ? "수금" : "매출"}</GridBadge>
                  </td>
                  <td>{row.customerName}</td>
                  <td>
                    {row.deliveryMethod ? (
                      <GridBadge tone="muted">{row.deliveryMethod}</GridBadge>
                    ) : (
                      <span style={{ color: "var(--erp-text-muted)" }}>-</span>
                    )}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.authorName ?? "-"}</td>
                  <td style={isCollection ? { color: "var(--erp-text-muted)" } : undefined}>{row.productLabel}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.spec}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.lotNumber || "-"}</td>
                  <td className="num">
                    {isCollection ? "-" : `${row.quantity.toLocaleString()} ${row.unit ?? ""}`}
                  </td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {!isCollection && row.unitPrice != null ? row.unitPrice.toLocaleString() : "-"}
                  </td>
                  <td className="num">{row.supplyAmount.toLocaleString()}</td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    {isCollection ? "-" : row.taxAmount.toLocaleString()}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{row.remark || "-"}</td>
                  <td className="num">
                    {row.orderId && (
                      <Link
                        href={`/sales/${row.orderId}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--erp-primary)", fontWeight: 600 }}
                      >
                        명세표 →
                      </Link>
                    )}
                  </td>
                </ClickableRow>
              );
            })}
            {!sortedRows.length && (
              <tr>
                <td colSpan={15} className="erp-grid-empty">
                  조건에 맞는 판매 거래가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {sortedRows.length > 0 && (
            <tfoot>
              <tr style={{ background: "#eef1f5", fontWeight: 700 }}>
                <td colSpan={2} style={stickyFooterStyle(0)} />
                <td colSpan={7} style={stickyFooterStyle(GRID_CHECKBOX_WIDTH + STICKY_2_WIDTH)}>
                  매출 합계 ({sortedRows.filter((r) => r.kind === "sale").length}건)
                </td>
                <td className="num">{totalQuantity.toLocaleString()}</td>
                <td />
                <td className="num">{totalSupply.toLocaleString()}</td>
                <td className="num">{totalTax.toLocaleString()}</td>
                <td />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
