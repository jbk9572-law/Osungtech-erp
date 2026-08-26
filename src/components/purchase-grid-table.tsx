"use client";

import {
  Fragment,
  useActionState,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { ClickableRow } from "@/components/clickable-row";
import type { FormState } from "@/components/form-message";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { bulkDeletePurchases } from "@/app/(dashboard)/purchases/actions";
import { useSortableRows } from "@/lib/grid-sort";
import { SortableTh } from "@/components/grid/sortable-th";
import {
  stickyHeaderStyle,
  stickyCellStyle,
  stickyFooterStyle,
  GRID_CHECKBOX_WIDTH,
} from "@/lib/grid-sticky";
import { GridBadge } from "@/components/grid/badge";
import { formatNumOrDash } from "@/lib/format-num-or-dash";

export type PurchaseRowItem = {
  productLabel: string;
  spec: string;
  lotNumber: string | null;
  remark: string | null;
  quantity: number;
  unit: string | null | undefined;
  unitCost: number | null;
  supplyAmount: number;
  taxAmount: number;
};

export type PurchaseRow = {
  key: string;
  kind: "purchase" | "payment";
  orderId: string | undefined;
  supplierId?: string;
  date: string | undefined;
  supplierName: string | undefined;
  authorName: string | null | undefined;
  productLabel: string;
  spec: string;
  lotNumber?: string | null;
  remark?: string | null;
  quantity: number;
  unit: string | null | undefined;
  unitCost: number | null;
  supplyAmount: number;
  taxAmount: number;
  deliveryMethod?: string | null;
  // 품목이 2건 이상인 명세표만 채워진다 — 목록에서 "품목A 외 N건"으로
  // 뭉뚱그려진 걸 상세 페이지로 넘어가지 않고 행 아래에 펼쳐서 볼 수
  // 있게 하기 위함.
  items?: PurchaseRowItem[];
};

type SortKey =
  | "date"
  | "supplierName"
  | "authorName"
  | "quantity"
  | "supplyAmount"
  | "taxAmount";

// 매입일자 칸(체크박스 다음)은 옆으로 스크롤해도 항상 보이게 고정한다 —
// 매출관리 그리드와 동일한 패턴.
const STICKY_2_WIDTH = 92;

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
  const { sortedRows, toggleSort, sortIndicator, ariaSortFor } =
    useSortableRows<PurchaseRow, SortKey>(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    bulkDeletePurchases,
    undefined,
  );

  function toggleExpand(key: string, e: MouseEvent) {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
      if (
        row.orderId &&
        selected.has(row.orderId) &&
        row.supplierName &&
        !seen.has(row.orderId)
      ) {
        seen.add(row.orderId);
        names.push(row.supplierName);
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
    [sortedRows],
  );
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

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

  function sortableHeader(
    label: string,
    key: SortKey,
    extraStyle?: CSSProperties,
    className?: string,
  ) {
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
          warningText="선택한 매입 건을 삭제하면 재고 수량이 자동으로 되돌아갑니다. 되돌릴 수 없습니다."
          confirmText={confirmText}
          onConfirmTextChange={setConfirmText}
        />
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={thSticky1}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                />
              </th>
              {sortableHeader("매입일자", "date", thSticky2)}
              <th style={{ width: 64 }}>유형</th>
              {sortableHeader("공급처", "supplierName")}
              <th style={{ width: 76 }}>입고방법</th>
              {sortableHeader("작성자", "authorName")}
              <th>품목명 / 적요</th>
              <th>규격</th>
              <th>관리번호</th>
              {sortableHeader("수량", "quantity", undefined, "num")}
              <th className="num">매입가</th>
              {sortableHeader("공급가액", "supplyAmount", undefined, "num")}
              {sortableHeader("세액", "taxAmount", undefined, "num")}
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const isRowSelected = !!row.orderId && selected.has(row.orderId);
              const isPayment = row.kind === "payment";
              const href = row.orderId
                ? `/purchases/${row.orderId}${backParam ? `?back=${backParam}` : ""}`
                : row.supplierId
                  ? `/suppliers/${row.supplierId}`
                  : "#";
              const hasMultipleItems = !!row.items && row.items.length > 1;
              const isExpanded = expanded.has(row.key);
              return (
                <Fragment key={row.key}>
                  <ClickableRow
                    href={href}
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
                    <td style={tdSticky2}>
                      {row.date
                        ? new Date(row.date).toLocaleDateString("ko-KR")
                        : "-"}
                    </td>
                    <td>
                      <GridBadge tone={isPayment ? "muted" : "info"}>
                        {isPayment ? "지급" : "매입"}
                      </GridBadge>
                    </td>
                    <td>{row.supplierName}</td>
                    <td>
                      {row.deliveryMethod ? (
                        <GridBadge tone="muted">{row.deliveryMethod}</GridBadge>
                      ) : (
                        <span style={{ color: "var(--erp-text-muted)" }}>
                          -
                        </span>
                      )}
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>
                      {row.authorName ?? "-"}
                    </td>
                    <td
                      style={
                        isPayment
                          ? { color: "var(--erp-text-muted)" }
                          : undefined
                      }
                    >
                      {hasMultipleItems && (
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(row.key, e)}
                          aria-label={isExpanded ? "품목 접기" : "품목 펼치기"}
                          aria-expanded={isExpanded}
                          style={{
                            marginRight: 6,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--erp-text-muted)",
                            fontSize: 11,
                            padding: 0,
                          }}
                        >
                          {isExpanded ? "▾" : "▸"}
                        </button>
                      )}
                      {row.productLabel}
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>
                      {row.spec}
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>
                      {row.lotNumber || "-"}
                    </td>
                    <td className="num">
                      {isPayment
                        ? "-"
                        : `${row.quantity.toLocaleString()} ${row.unit ?? ""}`}
                    </td>
                    <td
                      className="num"
                      style={{ color: "var(--erp-text-muted)" }}
                    >
                      {isPayment ? "-" : formatNumOrDash(row.unitCost)}
                    </td>
                    <td className="num">{row.supplyAmount.toLocaleString()}</td>
                    <td
                      className="num"
                      style={{ color: "var(--erp-text-muted)" }}
                    >
                      {isPayment ? "-" : row.taxAmount.toLocaleString()}
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>
                      {row.remark || "-"}
                    </td>
                  </ClickableRow>
                  {isExpanded &&
                    row.items?.map((item, i) => (
                      <tr
                        key={`${row.key}-item-${i}`}
                        style={{ background: "var(--erp-bg-subtle)" }}
                      >
                        <td style={tdSticky1} />
                        <td style={tdSticky2} />
                        <td />
                        <td />
                        <td />
                        <td />
                        <td
                          style={{
                            paddingLeft: 26,
                            color: "var(--erp-text-muted)",
                          }}
                        >
                          {item.productLabel}
                        </td>
                        <td style={{ color: "var(--erp-text-muted)" }}>
                          {item.spec}
                        </td>
                        <td style={{ color: "var(--erp-text-muted)" }}>
                          {item.lotNumber || "-"}
                        </td>
                        <td className="num">
                          {item.quantity.toLocaleString()} {item.unit ?? ""}
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          {formatNumOrDash(item.unitCost)}
                        </td>
                        <td className="num">
                          {item.supplyAmount.toLocaleString()}
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          {item.taxAmount.toLocaleString()}
                        </td>
                        <td style={{ color: "var(--erp-text-muted)" }}>
                          {item.remark || "-"}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
            {!sortedRows.length && (
              <tr>
                <td colSpan={14} className="erp-grid-empty">
                  조건에 맞는 매입 거래가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {sortedRows.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
                <td colSpan={2} style={stickyFooterStyle(0)} />
                <td
                  colSpan={7}
                  style={stickyFooterStyle(
                    GRID_CHECKBOX_WIDTH + STICKY_2_WIDTH,
                  )}
                >
                  매입 합계 (
                  {sortedRows.filter((r) => r.kind === "purchase").length}건)
                </td>
                <td className="num">{totalQuantity.toLocaleString()}</td>
                <td />
                <td className="num">{totalSupply.toLocaleString()}</td>
                <td className="num">{totalTax.toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
