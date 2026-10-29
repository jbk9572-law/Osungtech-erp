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
import { RowCheckbox } from "@/components/grid/row-checkbox";
import { OrderDetailPanel, type OrderDetailSelection } from "@/components/grid/order-detail-panel";
import { formatCarryoverDate } from "@/lib/carryover";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { formatNumber } from "@/lib/format-number";
import { buildBackHref, resolveListHref } from "@/lib/list-return";
import { useColumnVisibility } from "@/lib/use-column-visibility";
import { ColumnVisibilityMenu, type ColumnVisibilityOption } from "@/components/grid/column-visibility-menu";

// 매출(sales-grid-table.tsx)과 같은 이유로 계정별로 끌 수 있는 칸만
// 여기 올린다 — 날짜/공급처/품목명/수량/금액 같은 핵심 칸은 빼서 못
// 끄게 한다.
const PURCHASE_HIDEABLE_COLUMNS: ColumnVisibilityOption[] = [
  { key: "docNo", label: "전표번호" },
  { key: "supplierCode", label: "공급처코드" },
  { key: "kind", label: "유형" },
  { key: "taxType", label: "과세구분" },
  { key: "evidenceType", label: "증빙유형" },
  { key: "deliveryMethod", label: "입고방법" },
  { key: "authorName", label: "작성자" },
  { key: "spec", label: "규격" },
  { key: "lotNumber", label: "관리번호" },
  { key: "unitCost", label: "매입가" },
  { key: "invoiceReceived", label: "세금계산서 수취" },
  { key: "remark", label: "비고" },
];

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
  // 모조지(TG0) 품목 줄에만 채워진다 — 이 수량이 어떤 규격들로 재단됐는지
  // "가로×세로 : 수량" 형태로. 값이 있으면 아래 품목내역 패널에서 이 줄
  // 아래 한 단계 더 들여써서 보여준다.
  paperCalcSizeLines?: string[];
};

export type PurchaseRow = {
  key: string;
  kind: "purchase" | "payment";
  orderId: string | undefined;
  supplierId?: string;
  docNo?: number | null;
  supplierCode?: string | null;
  taxType?: "과세" | "면세" | "영세" | null;
  evidenceType?: string | null;
  invoiceReceived?: boolean;
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
  // 매입일자(date)는 실제 처리일 그대로지만, 이 건이 월별 집계에서는
  // 다음 달 실적으로 잡힌다는 걸 날짜 옆 배지로 보여주기 위함.
  isCarryover?: boolean;
  // 품목이 2건 이상인 명세표만 채워진다 — 아래 품목내역 패널에서 이 건을
  // 선택했을 때 보여줄 품목 목록.
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
  carryoverRows,
  carryoverQuantity,
  carryoverSupply,
  carryoverTax,
}: {
  rows: PurchaseRow[];
  totalQuantity: number;
  totalSupply: number;
  totalTax: number;
  backParam: string;
  // 전월 이월분(작업일은 전월이지만 이번 달 실적으로 잡히는 건) —
  // sales-grid-table.tsx와 같은 이유로 목록에도 별도 구간·별도 소계로
  // 보여준다(아래 "매입 합계"와 합산되지 않음).
  carryoverRows?: PurchaseRow[];
  carryoverQuantity?: number;
  carryoverSupply?: number;
  carryoverTax?: number;
}) {
  const { sortedRows, toggleSort, sortIndicator, ariaSortFor, applySort } =
    useSortableRows<PurchaseRow, SortKey>(rows);
  const { isHidden, toggleColumn } = useColumnVisibility("purchase-list");
  const colStyle = (key: string, extra?: CSSProperties): CSSProperties => ({
    ...extra,
    ...(isHidden(key) ? { display: "none" } : undefined),
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  // 모바일 카드 목록에서 "선택" 버튼을 눌렀을 때만 체크박스를 보여준다
  // (sales-grid-table.tsx와 같은 패턴).
  const [mobileSelectMode, setMobileSelectMode] = useState(false);
  // 마스터-디테일 레이아웃: 지금 아래 품목내역 패널에 표시 중인 명세표.
  // 일괄삭제 체크박스(selected)와는 별개의 상태다. 사용자가 직접 고른 적이
  // 없거나 그 행이 더 이상 목록에 없으면(필터 변경 등) 첫 매입 건으로
  // 자동 대체한다 — effect 없이 렌더 중 계산해서 캐스케이드 렌더를 피한다.
  const [manualActiveKey, setManualActiveKey] = useState<string | null>(null);
  const activeKey =
    manualActiveKey && sortedRows.some((row) => row.key === manualActiveKey)
      ? manualActiveKey
      : (sortedRows.find((row) => row.orderId)?.key ?? null);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    bulkDeletePurchases,
    undefined,
  );

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
  // 전월 이월분 행 전용 톤 — sales-grid-table.tsx와 같은 이유(스티키 칸은
  // 자기 배경색을 따로 가져서 <tr style>만으로는 색이 안 먹는다).
  const tdSticky1Carryover = stickyCellStyle(0, GRID_CHECKBOX_WIDTH, {
    background: "var(--erp-info-bg)",
    borderLeft: "3px solid var(--erp-warning)",
  });
  const tdSticky2Carryover = stickyCellStyle(GRID_CHECKBOX_WIDTH, STICKY_2_WIDTH, {
    borderRight: "1px solid var(--erp-border)",
    background: "var(--erp-info-bg)",
  });

  const activeRow = sortedRows.find((row) => row.key === activeKey) ?? null;
  const activeSelection: OrderDetailSelection | null = activeRow
    ? {
        label: activeRow.supplierName ?? "-",
        dateLabel: activeRow.date
          ? new Date(activeRow.date).toLocaleDateString("ko-KR")
          : "-",
        items:
          activeRow.items?.map((item) => ({ ...item, unitPrice: item.unitCost })) ??
          (activeRow.kind === "purchase"
            ? [
                {
                  productLabel: activeRow.productLabel,
                  spec: activeRow.spec,
                  lotNumber: activeRow.lotNumber ?? null,
                  remark: activeRow.remark ?? null,
                  quantity: activeRow.quantity,
                  unit: activeRow.unit,
                  unitPrice: activeRow.unitCost,
                  supplyAmount: activeRow.supplyAmount,
                  taxAmount: activeRow.taxAmount,
                },
              ]
            : []),
      }
    : null;

  // sales-grid-table.tsx와 같은 이유로 행 렌더링을 함수로 뺀다 — 일반 행과
  // 전월 이월분 행이 완전히 같은 칸 구조로 그려지되, 전월 이월분 행은
  // compactDate(연도 생략 "MM.DD" + 짧은 "이월" 배지)만 다르게 쓴다.
  function renderRow(row: PurchaseRow, opts: { selectable: boolean; compactDate?: boolean }) {
    const isRowSelected = opts.selectable && !!row.orderId && selected.has(row.orderId);
    const isPayment = row.kind === "payment";
    const detailHref = row.orderId
      ? `/purchases/${row.orderId}${backParam ? `?back=${backParam}` : ""}`
      : row.supplierId
        ? // 공급처 상세를 닫으면 공급처 목록이 아니라 지금 이
          // 매입 화면(필터까지 포함)으로 돌아와야 한다(사용자
          // 지적 — "상세보기 끄면 엉뚱한 메뉴로 이동해버린다").
          `/suppliers/${row.supplierId}?back=${buildBackHref(resolveListHref("/purchases", backParam))}`
        : null;
    const isActive = opts.selectable && row.key === activeKey;
    return (
      <tr
        key={row.key}
        className={`cursor-pointer${isRowSelected ? " selected" : isActive ? " master-active" : ""}`}
        onClick={() => setManualActiveKey(row.key)}
      >
        <td style={opts.compactDate ? tdSticky1Carryover : tdSticky1}>
          {opts.selectable && row.orderId && (
            <RowCheckbox
              checked={isRowSelected}
              onChange={() => toggleRow(row.orderId!)}
              label={`${row.date ? new Date(row.date).toLocaleDateString("ko-KR") + " " : ""}${row.supplierName ?? ""} 선택`}
            />
          )}
        </td>
        <td style={opts.compactDate ? tdSticky2Carryover : tdSticky2}>
          {row.date
            ? opts.compactDate
              ? formatCarryoverDate(row.date)
              : new Date(row.date).toLocaleDateString("ko-KR")
            : "-"}
          {row.isCarryover && row.date && (
            <GridBadge tone="warn" style={{ marginLeft: 4 }}>
              이월
            </GridBadge>
          )}
        </td>
        <td style={colStyle("docNo", { color: "var(--erp-text-muted)" })}>
          {row.docNo ?? "-"}
        </td>
        <td style={colStyle("supplierCode", { color: "var(--erp-text-muted)" })}>
          {row.supplierCode ?? "-"}
        </td>
        <td style={colStyle("kind")}>
          <GridBadge tone={isPayment ? "muted" : "info"}>
            {isPayment ? "지급" : "매입"}
          </GridBadge>
        </td>
        <td style={colStyle("taxType")}>
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
        <td style={colStyle("evidenceType", { color: "var(--erp-text-muted)" })}>
          {row.evidenceType ?? "-"}
        </td>
        <td>{row.supplierName}</td>
        <td style={colStyle("deliveryMethod")}>
          {row.deliveryMethod ? (
            <GridBadge tone="muted">{row.deliveryMethod}</GridBadge>
          ) : (
            <span style={{ color: "var(--erp-text-muted)" }}>
              -
            </span>
          )}
        </td>
        <td style={colStyle("authorName", { color: "var(--erp-text-muted)" })}>
          {row.authorName ?? "-"}
        </td>
        <td
          style={
            isPayment
              ? { color: "var(--erp-text-muted)" }
              : undefined
          }
        >
          {row.productLabel}
        </td>
        <td style={colStyle("spec", { color: "var(--erp-text-muted)" })}>
          {row.spec}
        </td>
        <td style={colStyle("lotNumber", { color: "var(--erp-text-muted)" })}>
          {row.lotNumber || "-"}
        </td>
        <td className="num">
          {isPayment
            ? "-"
            : `${formatNumber(row.quantity)} ${row.unit ?? ""}`}
        </td>
        <td
          className="num"
          style={colStyle("unitCost", { color: "var(--erp-text-muted)" })}
        >
          {isPayment ? "-" : formatNumOrDash(row.unitCost)}
        </td>
        <td className="num">{formatNumber(row.supplyAmount)}</td>
        <td
          className="num"
          style={{ color: "var(--erp-text-muted)" }}
        >
          {isPayment ? "-" : formatNumber(row.taxAmount)}
        </td>
        <td style={colStyle("invoiceReceived")}>
          {isPayment ? (
            "-"
          ) : row.invoiceReceived ? (
            <span style={{ color: "var(--erp-success)", fontWeight: 700 }}>✓ 수취</span>
          ) : (
            <span style={{ color: "var(--erp-text-muted)" }}>미수취</span>
          )}
        </td>
        <td style={colStyle("remark", { color: "var(--erp-text-muted)" })}>
          {row.remark || "-"}
        </td>
        <td className="num" onClick={(e) => e.stopPropagation()}>
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
        </td>
      </tr>
    );
  }

  // 표의 renderRow와 같은 데이터로 모바일 카드 한 장을 그린다 — 핵심
  // 정보(날짜·공급처·품목/규격·수량·금액)만 보여주고 전표번호/작성자/
  // 세액/비고 등은 상세 화면으로 넘긴다(sales-grid-table.tsx와 같은 패턴,
  // 사용자 승인 — "나머진 뭐 상세로 가도되고").
  function renderMobileCard(row: PurchaseRow, opts: { selectable: boolean; compactDate?: boolean }) {
    const isPayment = row.kind === "payment";
    const isRowSelected = opts.selectable && !!row.orderId && selected.has(row.orderId);
    const detailHref = row.orderId
      ? `/purchases/${row.orderId}${backParam ? `?back=${backParam}` : ""}`
      : row.supplierId
        ? `/suppliers/${row.supplierId}?back=${buildBackHref(resolveListHref("/purchases", backParam))}`
        : null;
    const dateLabel = row.date
      ? opts.compactDate
        ? formatCarryoverDate(row.date)
        : new Date(row.date).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })
      : "-";

    const body = (
      <>
        <div className="erp-row-card-head">
          {opts.selectable && mobileSelectMode && row.orderId ? (
            <label className="erp-row-card-checkbox">
              <input
                type="checkbox"
                checked={isRowSelected}
                onChange={() => toggleRow(row.orderId!)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`${row.supplierName ?? ""} 선택`}
              />
              <span className="erp-row-card-partner">{row.supplierName ?? "-"}</span>
            </label>
          ) : (
            <span className="erp-row-card-partner">{row.supplierName ?? "-"}</span>
          )}
          <span className="erp-row-card-date">
            {dateLabel}
            {row.isCarryover && row.date && (
              <GridBadge tone="warn" style={{ marginLeft: 4 }}>
                이월
              </GridBadge>
            )}
          </span>
        </div>
        <div className="erp-row-card-item">
          {row.productLabel}
          {row.spec ? ` · ${row.spec}` : ""}
        </div>
        <div className="erp-row-card-foot">
          <span className="erp-row-card-qty">
            {isPayment ? "-" : `${formatNumber(row.quantity)} ${row.unit ?? ""}`}
          </span>
          <span className="erp-row-card-amount">{formatNumber(row.supplyAmount)}원</span>
        </div>
        <div className="erp-row-card-badges">
          <GridBadge tone={isPayment ? "muted" : "info"}>{isPayment ? "지급" : "매입"}</GridBadge>
          {!isPayment &&
            (row.invoiceReceived ? (
              <GridBadge tone="ok">세금계산서 수취</GridBadge>
            ) : (
              <GridBadge tone="muted">세금계산서 미수취</GridBadge>
            ))}
        </div>
      </>
    );

    if (!detailHref || (opts.selectable && mobileSelectMode)) {
      return (
        <div key={row.key} className={`erp-row-card${isRowSelected ? " selected" : ""}`}>
          {body}
        </div>
      );
    }
    return (
      <Link key={row.key} href={detailHref} className="erp-row-card">
        {body}
      </Link>
    );
  }

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

      <div className="erp-grid-toolbar">
        <ColumnVisibilityMenu options={PURCHASE_HIDEABLE_COLUMNS} isHidden={isHidden} onToggle={toggleColumn} />
      </div>

      <div className="erp-grid-wrap has-card-view">
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
              <th style={colStyle("docNo", { width: 90 })}>전표번호</th>
              <th style={colStyle("supplierCode", { width: 76 })}>공급처코드</th>
              <th style={colStyle("kind", { width: 64 })}>유형</th>
              <th style={colStyle("taxType", { width: 60 })}>과세구분</th>
              <th style={colStyle("evidenceType", { width: 90 })}>증빙유형</th>
              {sortableHeader("공급처", "supplierName")}
              <th style={colStyle("deliveryMethod", { width: 76 })}>입고방법</th>
              {sortableHeader("작성자", "authorName", colStyle("authorName"))}
              <th>품목명 / 적요</th>
              <th style={colStyle("spec")}>규격</th>
              <th style={colStyle("lotNumber")}>관리번호</th>
              {sortableHeader("수량", "quantity", undefined, "num")}
              <th className="num" style={colStyle("unitCost")}>매입가</th>
              {sortableHeader("공급가액", "supplyAmount", undefined, "num")}
              {sortableHeader("세액", "taxAmount", undefined, "num")}
              <th style={colStyle("invoiceReceived", { width: 86 })}>세금계산서 수취</th>
              <th style={colStyle("remark")}>비고</th>
              <th />
            </tr>
          </thead>
          {carryoverRows && carryoverRows.length > 0 && (
            <tbody>
              <tr>
                <td
                  colSpan={20}
                  style={{ background: "var(--erp-bg)", fontWeight: 700, color: "var(--erp-text-muted)", padding: "6px 8px" }}
                >
                  전월 이월분 · 이번달 실적으로 반영됨
                </td>
              </tr>
              {carryoverRows.map((row) => renderRow(row, { selectable: false, compactDate: true }))}
              <tr>
                <td colSpan={2} style={stickyFooterStyle(0)} />
                <td
                  colSpan={11}
                  style={{ color: "var(--erp-text-muted)", fontSize: "var(--erp-font-xs)", padding: "4px 8px" }}
                >
                  전월 이월 소계 ({carryoverRows.length}건)
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)", fontSize: "var(--erp-font-xs)" }}>
                  {formatNumber(carryoverQuantity ?? 0)}
                </td>
                <td />
                <td className="num" style={{ color: "var(--erp-text-muted)", fontSize: "var(--erp-font-xs)" }}>
                  {formatNumber(carryoverSupply ?? 0)}
                </td>
                <td className="num" style={{ color: "var(--erp-text-muted)", fontSize: "var(--erp-font-xs)" }}>
                  {formatNumber(carryoverTax ?? 0)}
                </td>
                <td />
                <td />
                <td />
              </tr>
            </tbody>
          )}
          <tbody>
            {sortedRows.map((row) => renderRow(row, { selectable: true }))}
            {!sortedRows.length && (
              <tr>
                <td colSpan={20} className="erp-grid-empty">
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
                  colSpan={11}
                  style={stickyFooterStyle(
                    GRID_CHECKBOX_WIDTH + STICKY_2_WIDTH,
                  )}
                >
                  매입 합계 (
                  {sortedRows.filter((r) => r.kind === "purchase").length}건)
                </td>
                <td className="num">{formatNumber(totalQuantity)}</td>
                <td />
                <td className="num">{formatNumber(totalSupply)}</td>
                <td className="num">{formatNumber(totalTax)}</td>
                <td />
                <td />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="erp-row-card-toolbar">
        <button
          type="button"
          className="erp-btn"
          onClick={() => {
            setMobileSelectMode((v) => !v);
            if (mobileSelectMode) setSelected(new Set());
          }}
        >
          {mobileSelectMode ? "선택 취소" : "선택"}
        </button>
        <select
          className="erp-select"
          aria-label="정렬"
          defaultValue=""
          onChange={(e) => {
            const [key, dir] = e.target.value.split(":") as [SortKey, "1" | "-1"];
            applySort(key, dir === "1" ? 1 : -1);
          }}
        >
          <option value="" disabled>
            정렬
          </option>
          <option value="date:-1">최신순</option>
          <option value="date:1">오래된순</option>
          <option value="supplyAmount:-1">금액 높은순</option>
          <option value="supplyAmount:1">금액 낮은순</option>
          <option value="supplierName:1">공급처순</option>
        </select>
      </div>
      <div className="erp-row-card-list">
        {carryoverRows && carryoverRows.length > 0 && (
          <>
            <div style={{ fontSize: "var(--erp-font-xs)", fontWeight: 700, color: "var(--erp-text-muted)" }}>
              전월 이월분 · 이번달 실적으로 반영됨
            </div>
            {carryoverRows.map((row) => renderMobileCard(row, { selectable: false, compactDate: true }))}
          </>
        )}
        {sortedRows.map((row) => renderMobileCard(row, { selectable: true }))}
        {!sortedRows.length && <p className="erp-grid-empty">조건에 맞는 매입 거래가 없습니다.</p>}
      </div>

      <OrderDetailPanel
        selection={activeSelection}
        priceLabel="매입가"
        emptyMessage="위 목록에서 명세표를 선택하면 품목내역이 여기에 표시됩니다."
      />
    </>
  );
}
