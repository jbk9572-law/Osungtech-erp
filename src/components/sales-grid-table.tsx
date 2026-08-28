"use client";

import {
  Fragment,
  useActionState,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
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
import { formatNumOrDash } from "@/lib/format-num-or-dash";

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
  // "가로×세로 : 수량" 형태로. 값이 있으면 드롭다운에서 이 줄 아래 한 단계
  // 더 들여써서 보여준다.
  paperCalcSizeLines?: string[];
};

export type SalesRow = {
  key: string;
  kind: "sale" | "collection";
  orderId: string | undefined;
  customerId?: string;
  date: string | undefined;
  customerName: string | undefined;
  authorName: string | null | undefined;
  // 반품(잘못 납품해 되돌아온 매출) 건이면 배지/부호를 반대로 보여준다 —
  // 재고는 늘어나고(+), 매출 합계에서는 차감된다(-).
  isReturn?: boolean;
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
  // 품목이 2건 이상인 명세표만 채워진다 — 목록에서 "품목A 외 N건"으로
  // 뭉뚱그려진 걸 상세 페이지로 넘어가지 않고 행 아래에 펼쳐서 볼 수
  // 있게 하기 위함.
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");

  function toggleExpand(key: string, e: MouseEvent) {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
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
              const hasMultipleItems = !!row.items && row.items.length > 1;
              const isExpanded = expanded.has(row.key);
              const isSummaryEmphasized = isExpanded && hasMultipleItems;
              return (
                <Fragment key={row.key}>
                  <ClickableRow
                    href={href}
                    className={
                      isRowSelected
                        ? "selected"
                        : isSummaryEmphasized
                          ? "summary-emphasis"
                          : undefined
                    }
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
                      {hasMultipleItems && (
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(row.key, e)}
                          aria-label={isExpanded ? "품목 접기" : "품목 펼치기"}
                          aria-expanded={isExpanded}
                          className="erp-expand-toggle"
                        >
                          {isExpanded ? "▾" : "▸"}
                        </button>
                      )}
                      {row.productLabel}
                      {isSummaryEmphasized && (
                        <GridBadge tone="warn" style={{ marginLeft: 6 }}>
                          합계
                        </GridBadge>
                      )}
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>
                      {row.spec}
                    </td>
                    <td style={{ color: "var(--erp-text-muted)" }}>
                      {row.lotNumber || "-"}
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
                    <td style={{ color: "var(--erp-text-muted)" }}>
                      {row.remark || "-"}
                    </td>
                    <td className="num">
                      {row.orderId && (
                        <Link
                          href={`/sales/${row.orderId}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "var(--erp-primary)",
                            fontWeight: 600,
                          }}
                        >
                          명세표 →
                        </Link>
                      )}
                    </td>
                  </ClickableRow>
                  {isExpanded &&
                    row.items?.map((item, i) => (
                      <Fragment key={`${row.key}-item-${i}`}>
                        <tr style={{ background: "var(--erp-bg-subtle)" }}>
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
                            {!!item.paperCalcSizeLines?.length && (
                              <GridBadge tone="info" style={{ marginLeft: 6 }}>
                                계산 연결됨
                              </GridBadge>
                            )}
                          </td>
                          <td style={{ color: "var(--erp-text-muted)" }}>
                            {item.spec}
                          </td>
                          <td style={{ color: "var(--erp-text-muted)" }}>
                            {item.lotNumber || "-"}
                          </td>
                          <td
                            className="num"
                            style={row.isReturn ? { color: "var(--erp-danger)" } : undefined}
                          >
                            {row.isReturn ? "+" : ""}
                            {item.quantity.toLocaleString()} {item.unit ?? ""}
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            {formatNumOrDash(item.unitPrice)}
                          </td>
                          <td
                            className="num"
                            style={row.isReturn ? { color: "var(--erp-danger)" } : undefined}
                          >
                            {row.isReturn ? "-" : ""}
                            {item.supplyAmount.toLocaleString()}
                          </td>
                          <td
                            className="num"
                            style={{ color: row.isReturn ? "var(--erp-danger)" : "var(--erp-text-muted)" }}
                          >
                            {row.isReturn ? "-" : ""}
                            {item.taxAmount.toLocaleString()}
                          </td>
                          <td style={{ color: "var(--erp-text-muted)" }}>
                            {item.remark || "-"}
                          </td>
                          <td />
                        </tr>
                        {item.paperCalcSizeLines?.map((line, lineIndex) => (
                          <tr
                            key={`${row.key}-item-${i}-size-${lineIndex}`}
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
                                paddingLeft: 44,
                                color: "var(--erp-text-muted)",
                                fontSize: 11.5,
                              }}
                            >
                              ㄴ {line}
                            </td>
                            <td />
                            <td />
                            <td />
                            <td />
                            <td />
                            <td />
                            <td />
                            <td />
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                </Fragment>
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
              <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
                <td colSpan={2} style={stickyFooterStyle(0)} />
                <td
                  colSpan={7}
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
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
