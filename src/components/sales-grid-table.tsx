"use client";

import {
  useActionState,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import type { FormState } from "@/components/form-message";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { bulkDeleteSales } from "@/app/(dashboard)/sales/actions";
import { useSortableRows } from "@/lib/grid-sort";
import { SortableTh } from "@/components/grid/sortable-th";
import {
  stickyHeaderStyle,
  stickyCellStyle,
  stickyFooterStyle,
  GRID_CHECKBOX_WIDTH,
} from "@/lib/grid-sticky";
import { GridBadge } from "@/components/grid/badge";
import { RowCheckbox } from "@/components/grid/row-checkbox";
import { OrderDetailPanel, type OrderDetailSelection } from "@/components/grid/order-detail-panel";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { nextMonthLabel } from "@/lib/carryover";

export type SalesRowItem = {
  productLabel: string;
  spec: string;
  lotNumber: string | null;
  remark: string | null;
  quantity: number;
  unit: string | null | undefined;
  unitPrice: number | null;
  supplyAmount: number;
  taxAmount: number;
  // 모조지(TG0) 품목 줄에만 채워진다 — 이 수량이 어떤 규격들로 재단됐는지
  // "가로×세로 : 수량" 형태로. 값이 있으면 아래 품목내역 패널에서 이 줄
  // 아래 한 단계 더 들여써서 보여준다.
  paperCalcSizeLines?: string[];
};

export type SalesRow = {
  key: string;
  kind: "sale" | "collection";
  orderId: string | undefined;
  customerId?: string;
  docNo?: number | null;
  customerCode?: string | null;
  taxType?: "과세" | "면세" | "영세" | null;
  evidenceType?: string | null;
  statementIssued?: boolean;
  invoiceStatus?: string;
  date: string | undefined;
  customerName: string | undefined;
  authorName: string | null | undefined;
  // 반품(잘못 납품해 되돌아온 매출) 건이면 배지/부호를 반대로 보여준다 —
  // 재고는 늘어나고(+), 매출 합계에서는 차감된다(-).
  isReturn?: boolean;
  // 거래일자(date)는 실제 처리일 그대로지만, 이 건이 월별 집계에서는
  // 다음 달 실적으로 잡힌다는 걸 날짜 옆 배지로 보여주기 위함.
  isCarryover?: boolean;
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
  // 품목이 2건 이상인 명세표만 채워진다 — 아래 품목내역 패널에서 이 건을
  // 선택했을 때 보여줄 품목 목록.
  items?: SalesRowItem[];
};

type SortKey =
  | "date"
  | "customerName"
  | "authorName"
  | "quantity"
  | "supplyAmount"
  | "taxAmount";

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
  const { sortedRows, toggleSort, sortIndicator, ariaSortFor } =
    useSortableRows<SalesRow, SortKey>(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  // 마스터-디테일 레이아웃: 지금 아래 품목내역 패널에 표시 중인 명세표.
  // 일괄삭제 체크박스(selected)와는 별개의 상태다. 사용자가 직접 고른 적이
  // 없거나 그 행이 더 이상 목록에 없으면(필터 변경 등) 첫 매출 건으로
  // 자동 대체한다 — effect 없이 렌더 중 계산해서 캐스케이드 렌더를 피한다.
  const [manualActiveKey, setManualActiveKey] = useState<string | null>(null);
  const activeKey =
    manualActiveKey && sortedRows.some((row) => row.key === manualActiveKey)
      ? manualActiveKey
      : (sortedRows.find((row) => row.orderId)?.key ?? null);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    bulkDeleteSales,
    undefined,
  );

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
      if (
        row.orderId &&
        selected.has(row.orderId) &&
        row.customerName &&
        !seen.has(row.orderId)
      ) {
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

  const activeRow = sortedRows.find((row) => row.key === activeKey) ?? null;
  const activeSelection: OrderDetailSelection | null = activeRow
    ? {
        label: activeRow.customerName ?? "-",
        dateLabel: activeRow.date
          ? new Date(activeRow.date).toLocaleDateString("ko-KR")
          : "-",
        isReturn: activeRow.isReturn,
        items:
          activeRow.items ??
          (activeRow.kind === "sale"
            ? [
                {
                  productLabel: activeRow.productLabel,
                  spec: activeRow.spec,
                  lotNumber: activeRow.lotNumber ?? null,
                  remark: activeRow.remark ?? null,
                  quantity: activeRow.quantity,
                  unit: activeRow.unit,
                  unitPrice: activeRow.unitPrice,
                  supplyAmount: activeRow.supplyAmount,
                  taxAmount: activeRow.taxAmount,
                },
              ]
            : []),
      }
    : null;

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
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                />
              </th>
              {sortableHeader("거래일자", "date", thSticky2)}
              <th style={{ width: 64 }}>유형</th>
              {sortableHeader("출고처", "customerName")}
              <th style={{ width: 76 }}>배송방법</th>
              {sortableHeader("작성자", "authorName")}
              <th>품목명 / 적요</th>
              <th>규격</th>
              <th>관리번호</th>
              <th style={{ width: 90 }}>전표번호</th>
              <th style={{ width: 76 }}>거래처코드</th>
              <th style={{ width: 60 }}>과세구분</th>
              <th style={{ width: 90 }}>증빙유형</th>
              {sortableHeader("수량", "quantity", undefined, "num")}
              <th className="num">공급가</th>
              {sortableHeader("공급가액", "supplyAmount", undefined, "num")}
              {sortableHeader("세액", "taxAmount", undefined, "num")}
              <th style={{ width: 76 }}>명세서발행</th>
              <th style={{ width: 76 }}>계산서발행</th>
              <th>비고</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const isRowSelected = !!row.orderId && selected.has(row.orderId);
              const isCollection = row.kind === "collection";
              const detailHref = row.orderId
                ? `/sales/${row.orderId}${backParam ? `?back=${backParam}` : ""}`
                : row.customerId
                  ? `/customers/${row.customerId}`
                  : null;
              const isActive = row.key === activeKey;
              return (
                <tr
                  key={row.key}
                  className={`cursor-pointer${isRowSelected ? " selected" : isActive ? " master-active" : ""}`}
                  onClick={() => setManualActiveKey(row.key)}
                >
                  <td style={tdSticky1}>
                    {row.orderId && (
                      <RowCheckbox
                        checked={isRowSelected}
                        onChange={() => toggleRow(row.orderId!)}
                        label={`${row.date ? new Date(row.date).toLocaleDateString("ko-KR") + " " : ""}${row.customerName ?? ""} 선택`}
                      />
                    )}
                  </td>
                  <td style={tdSticky2}>
                    {row.date
                      ? new Date(row.date).toLocaleDateString("ko-KR")
                      : "-"}
                    {row.isCarryover && row.date && (
                      <GridBadge tone="warn" style={{ marginLeft: 4 }}>
                        이월({nextMonthLabel(row.date)})
                      </GridBadge>
                    )}
                  </td>
                  <td>
                    <GridBadge
                      tone={isCollection ? "muted" : row.isReturn ? "danger" : "info"}
                    >
                      {isCollection ? "수금" : row.isReturn ? "반품" : "매출"}
                    </GridBadge>
                  </td>
                  <td>{row.customerName}</td>
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
                      isCollection
                        ? { color: "var(--erp-text-muted)" }
                        : undefined
                    }
                  >
                    {row.productLabel}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.spec}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.lotNumber || "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.docNo ?? "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.customerCode ?? "-"}
                  </td>
                  <td>
                    {row.taxType ? (
                      <GridBadge
                        tone={
                          row.taxType === "과세"
                            ? "info"
                            : row.taxType === "영세"
                              ? "warn"
                              : "muted"
                        }
                      >
                        {row.taxType}
                      </GridBadge>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.evidenceType ?? "-"}
                  </td>
                  <td
                    className="num"
                    style={row.isReturn ? { color: "var(--erp-danger)" } : undefined}
                  >
                    {isCollection
                      ? "-"
                      : `${row.isReturn ? "+" : ""}${row.quantity.toLocaleString()} ${row.unit ?? ""}`}
                  </td>
                  <td
                    className="num"
                    style={{ color: "var(--erp-text-muted)" }}
                  >
                    {isCollection ? "-" : formatNumOrDash(row.unitPrice)}
                  </td>
                  <td
                    className="num"
                    style={row.isReturn ? { color: "var(--erp-danger)" } : undefined}
                  >
                    {row.isReturn ? "-" : ""}
                    {row.supplyAmount.toLocaleString()}
                  </td>
                  <td
                    className="num"
                    style={{ color: row.isReturn ? "var(--erp-danger)" : "var(--erp-text-muted)" }}
                  >
                    {isCollection ? "-" : `${row.isReturn ? "-" : ""}${row.taxAmount.toLocaleString()}`}
                  </td>
                  <td>
                    {isCollection ? (
                      "-"
                    ) : row.statementIssued ? (
                      <span style={{ color: "var(--erp-success)", fontWeight: 700 }}>발행</span>
                    ) : (
                      <span style={{ color: "var(--erp-text-muted)" }}>미발행</span>
                    )}
                  </td>
                  <td>
                    {isCollection ? (
                      "-"
                    ) : row.invoiceStatus === "issued" ? (
                      <span style={{ color: "var(--erp-success)", fontWeight: 700 }}>발행</span>
                    ) : (
                      <span style={{ color: "var(--erp-text-muted)" }}>미발행</span>
                    )}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)" }}>
                    {row.remark || "-"}
                  </td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
                      {detailHref && (
                        <Link
                          href={detailHref}
                          title="상세 보기"
                          aria-label="상세 보기"
                          className="erp-icon-link"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                      {row.orderId && (
                        <Link
                          href={`/sales/${row.orderId}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="명세표 조회 (새 창)"
                          aria-label="명세표 조회"
                          className="erp-icon-link"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
                            <path d="M13.5 3.5V8h4" />
                            <path d="M9 13h6M9 16.5h6" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!sortedRows.length && (
              <tr>
                <td colSpan={21} className="erp-grid-empty">
                  조건에 맞는 판매 거래가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {sortedRows.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
                <td colSpan={2} style={stickyFooterStyle(0)} />
                <td
                  colSpan={11}
                  style={stickyFooterStyle(
                    GRID_CHECKBOX_WIDTH + STICKY_2_WIDTH,
                  )}
                >
                  매출 합계 (
                  {sortedRows.filter((r) => r.kind === "sale").length}건)
                </td>
                <td className="num">{totalQuantity.toLocaleString()}</td>
                <td />
                <td className="num">{totalSupply.toLocaleString()}</td>
                <td className="num">{totalTax.toLocaleString()}</td>
                <td />
                <td />
                <td />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <OrderDetailPanel
        selection={activeSelection}
        priceLabel="공급가"
        emptyMessage="위 목록에서 명세표를 선택하면 품목내역이 여기에 표시됩니다."
      />
    </>
  );
}
