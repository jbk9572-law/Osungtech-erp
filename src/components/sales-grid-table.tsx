"use client";

import { rowDay, rowDayClass } from "@/lib/row-day";
import {
  Fragment,
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
import { ErpSelect } from "@/components/erp/erp-select";
import {
  stickyHeaderStyle,
  stickyCellStyle,
  stickyFooterStyle,
  GRID_CHECKBOX_WIDTH,
  GRID_ACTION_COL_WIDTH,
} from "@/lib/grid-sticky";
import { GridBadge } from "@/components/grid/badge";
import { DeliveryMethodCell, OrderDateCell, TaxTypeCell } from "@/components/grid/order-row-cells";
import { RowCheckbox } from "@/components/grid/row-checkbox";
import { OrderDetailPanel, type OrderDetailSelection } from "@/components/grid/order-detail-panel";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { formatCarryoverDate } from "@/lib/carryover";
import { formatNumber } from "@/lib/format-number";
import { canIssueTaxInvoice, isTaxExempt } from "@/lib/tax-evidence-type";
import { buildBackHref, resolveListHref } from "@/lib/list-return";
import { useColumnVisibility } from "@/lib/use-column-visibility";
import { ColumnVisibilityMenu, type ColumnVisibilityOption } from "@/components/grid/column-visibility-menu";
import { GridToolbar } from "@/components/grid/grid-toolbar";

// 핵심 칸(체크박스/날짜/거래처/품목/수량/공급가액/세액/작업)은 끌 수
// 없게 여기 안 넣는다 — 나머지만 "컬럼 설정"에서 계정별로 켜고 끈다.
const SALES_HIDEABLE_COLUMNS: ColumnVisibilityOption[] = [
  { key: "docNo", label: "전표번호" },
  { key: "customerCode", label: "거래처코드" },
  { key: "kind", label: "유형" },
  { key: "taxType", label: "과세구분" },
  { key: "evidenceType", label: "증빙유형" },
  { key: "deliveryMethod", label: "배송방법" },
  { key: "authorName", label: "작성자" },
  { key: "spec", label: "규격" },
  { key: "lotNumber", label: "관리번호" },
  { key: "unitPrice", label: "공급가" },
  { key: "invoiceStatus", label: "계산서발행" },
  { key: "remark", label: "비고" },
];

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
  invoiceStatus?: string;
  date: string | undefined;
  customerName: string | undefined;
  authorName: string | null | undefined;
  // 반품(잘못 납품해 되돌아온 매출) 건이면 배지/부호를 반대로 보여준다 —
  // 재고는 늘어나고(+), 매출 합계에서는 차감된다(-).
  isReturn?: boolean;
  // 샘플(무상증정) 건 — 단가 0원으로 재고만 차감되고 매출/세액에는
  // 반영되지 않는다. "종류" 칸에 "샘플" 배지로 구분해서 보여준다.
  isSample?: boolean;
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
  carryoverRows,
  carryoverQuantity,
  carryoverSupply,
  carryoverTax,
}: {
  rows: SalesRow[];
  totalQuantity: number;
  totalSupply: number;
  totalTax: number;
  backParam: string;
  // 전월 이월분(작업일은 전월이지만 이번 달 실적으로 잡히는 건) — 목록
  // (업무 화면)에서도 보여야 담당자가 이번 달에 세금계산서를 발행해야 할
  // 건을 놓치지 않는다(사용자 지적). 아래 "매출 합계"(tfoot, 날짜 기준)와
  // 별도 구간·별도 소계로 보여주고 서로 합산되지 않는다.
  carryoverRows?: SalesRow[];
  carryoverQuantity?: number;
  carryoverSupply?: number;
  carryoverTax?: number;
}) {
  const { sortedRows, toggleSort, sortIndicator, ariaSortFor, applySort } =
    useSortableRows<SalesRow, SortKey>(rows);
  const { isHidden, toggleColumn } = useColumnVisibility("sales-list");
  const colStyle = (key: string, extra?: CSSProperties): CSSProperties => ({
    ...extra,
    ...(isHidden(key) ? { display: "none" } : undefined),
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  // 모바일 카드 목록은 평소엔 카드 전체가 상세로 가는 링크라 체크박스가
  // 없다 — "선택" 버튼을 눌렀을 때만 각 카드에 체크박스가 나타나
  // 표의 일괄삭제와 같은 selected/toggleRow를 그대로 쓸 수 있게 한다.
  const [mobileSelectMode, setMobileSelectMode] = useState(false);
  // 모바일 카드 목록의 정렬 드롭다운 — 값을 고르면 그 즉시 정렬만 적용하고
  // "정렬"이라는 placeholder로 되돌아가는 명령형 select라(현재 정렬
  // 상태를 보여주는 select가 아님), 선택 후 항상 빈 문자열로 리셋한다.
  const [mobileSortCmd, setMobileSortCmd] = useState("");
  // 행 클릭 시 그 행 바로 아래에 품목내역을 아코디언으로 펼친다 —
  // 전에는 첫 매출 건을 자동으로 펼쳐서 패널을 항상 보여줬는데, 그러면
  // "펼침 상태"가 아니라 "고정 패널"이라 아코디언이라 부를 수 없었다
  // (사용자 요청 — 제자리 펼침, 싱글 아코디언). 지금은 아무것도 안
  // 고른 기본값(null)에서 시작하고, 필터가 바뀌어 그 행이 목록에서
  // 사라지면 같이 접는다.
  const [manualActiveKey, setManualActiveKey] = useState<string | null>(null);
  const activeKey =
    manualActiveKey && sortedRows.some((row) => row.key === manualActiveKey)
      ? manualActiveKey
      : null;
  // 같은 행을 다시 클릭하면 접히고(토글), 다른 행을 클릭하면 그 행만
  // 펼쳐진다(싱글 아코디언 — activeKey가 값 하나뿐이라 구조적으로
  // 둘 이상 동시에 펼쳐질 수 없다).
  function toggleAccordion(key: string) {
    setManualActiveKey((prev) => (prev === key ? null : key));
  }
  // 펼쳐진 상태에서 Esc를 누르면 접는다 — 캡처 단계에서 먼저 가로채
  // stopPropagation하므로, 화면 전역 Esc 단축키(KeyboardShortcuts,
  // 목록 화면 나가기 등)까지는 안 번진다.
  useEscapeToClose(activeKey !== null, () => setManualActiveKey(null));

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
  // 전월 이월분 행은 일반 행과 구분되게 옅은 배경을 깔아둔다 — 스크롤해도
  // 붙어있는 스티키 칸(tdSticky1/2)은 자기 배경색을 따로 갖고 있어서
  // (stickyCellStyle이 var(--erp-panel) 고정), 그냥 <tr style>로 배경을
  // 주면 스티키 칸만 색이 안 먹어 이질감이 생긴다 — 스티키 칸 전용 톤을
  // 따로 만든다.
  const tdSticky1Carryover = stickyCellStyle(0, GRID_CHECKBOX_WIDTH, {
    borderLeft: "3px solid var(--erp-warning)",
  });
  const tdSticky2Carryover = stickyCellStyle(GRID_CHECKBOX_WIDTH, STICKY_2_WIDTH, {
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

  // 행 렌더링을 함수로 빼서, 일반 행(sortedRows, 체크박스/정렬 대상)과
  // 전월 이월분 행(carryoverRows, 참고용·선택 대상 아님)이 완전히 똑같은
  // 칸 구조로 그려지게 한다 — 두 번째 장소에서 또 마크업을 복붙하지
  // 않는다. compactDate는 전월 이월분 구간에서만 true로 넘어온다(구간
  // 제목이 이미 "전월(N월)"이라고 말해주므로 각 행에서 연도·월을 또
  // 반복하지 않고 "MM.DD + 이월" 짧은 표기를 쓴다 — 그래야 바로 아래
  // "이번달 신규" 행들과 칸 너비가 들쭉날쭉해지지 않는다).
  function renderRow(row: SalesRow, opts: { selectable: boolean; compactDate?: boolean }) {
    const isRowSelected = opts.selectable && !!row.orderId && selected.has(row.orderId);
    const isCollection = row.kind === "collection";
    const detailHref = row.orderId
      ? `/sales/${row.orderId}${backParam ? `?back=${backParam}` : ""}`
      : row.customerId
        ? // 거래처 상세를 닫으면 거래처 목록이 아니라 지금 이
          // 매출 화면(필터까지 포함)으로 돌아와야 한다(사용자
          // 지적 — "상세보기 끄면 엉뚱한 메뉴로 이동해버린다").
          `/customers/${row.customerId}?back=${buildBackHref(resolveListHref("/sales", backParam))}`
        : null;
    const isActive = opts.selectable && row.key === activeKey;
    // 세금계산서를 바로 작성할 수 있는 건만 목록에서 바로
    // 진입 아이콘을 보여준다 — 이미 발행됐거나(issued),
    // 면세/다른 증빙(현금영수증 등)으로 발행 대상이 아닌
    // 건은 눌러도 바로 막히는 화면만 보게 되므로 아예
    // 숨긴다(상세→세금계산서 화면의 차단 조건과 동일, 두
    // 군데가 따로 놀지 않게 같은 헬퍼를 그대로 쓴다).
    const canQuickIssue =
      !isCollection &&
      !!row.orderId &&
      row.invoiceStatus !== "issued" &&
      !!row.taxType &&
      !isTaxExempt(row.taxType) &&
      canIssueTaxInvoice(row.evidenceType ?? null);
    return (
      <tr
        key={row.key}
        className={`cursor-pointer${isRowSelected ? " selected" : isActive ? " master-active" : ""}${rowDayClass(rowDay(row.date))}${row.isCarryover ? " row-carryover" : ""}`}
        onClick={() => opts.selectable && toggleAccordion(row.key)}
      >
        <td style={opts.compactDate ? tdSticky1Carryover : tdSticky1}>
          {opts.selectable && row.orderId && (
            <RowCheckbox
              checked={isRowSelected}
              onChange={() => toggleRow(row.orderId!)}
              label={`${row.date ? new Date(row.date).toLocaleDateString("ko-KR") + " " : ""}${row.customerName ?? ""} 선택`}
            />
          )}
        </td>
        <OrderDateCell
          date={row.date}
          compact={!!opts.compactDate}
          isCarryover={!!row.isCarryover}
          style={opts.compactDate ? tdSticky2Carryover : tdSticky2}
        />
        <td style={colStyle("docNo", { color: "var(--erp-text-muted)" })}>
          {row.docNo ?? "-"}
        </td>
        <td style={colStyle("customerCode", { color: "var(--erp-text-muted)" })}>
          {row.customerCode ?? "-"}
        </td>
        <td style={colStyle("kind")}>
          {/* 평범한 매출 건까지 danger(빨강) 톤으로 떨어지던 버그 —
              danger는 반품(실제로 주의가 필요한 상태)에만 쓰고,
              매출은 info(파랑, 중립적 정보)로 바꾼다. */}
          <GridBadge tone={isCollection ? "muted" : row.isReturn ? "danger" : row.isSample ? "warn" : "info"}>
            {isCollection ? "수금" : row.isReturn ? "반품" : row.isSample ? "샘플" : "매출"}
          </GridBadge>
        </td>
        <TaxTypeCell taxType={row.taxType} style={colStyle("taxType")} />
        <td style={colStyle("evidenceType", { color: "var(--erp-text-muted)" })}>
          {row.evidenceType ?? "-"}
        </td>
        <td>{row.customerName}</td>
        <DeliveryMethodCell deliveryMethod={row.deliveryMethod} style={colStyle("deliveryMethod")} />
        <td style={colStyle("authorName", { color: "var(--erp-text-muted)" })}>
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
        <td style={colStyle("spec", { color: "var(--erp-text-muted)" })}>
          {row.spec}
        </td>
        <td style={colStyle("lotNumber", { color: "var(--erp-text-muted)" })}>
          {row.lotNumber || "-"}
        </td>
        <td
          className="num"
          style={row.isReturn ? { color: "var(--erp-danger)" } : undefined}
        >
          {isCollection
            ? "-"
            : `${row.isReturn ? "+" : ""}${formatNumber(row.quantity)} ${row.unit ?? ""}`}
        </td>
        <td
          className="num"
          style={colStyle("unitPrice", { color: "var(--erp-text-muted)" })}
        >
          {isCollection ? "-" : formatNumOrDash(row.unitPrice)}
        </td>
        <td
          className="num"
          style={row.isReturn ? { color: "var(--erp-danger)" } : undefined}
        >
          {row.isReturn ? "-" : ""}
          {formatNumber(row.supplyAmount)}
        </td>
        <td
          className="num"
          style={{ color: row.isReturn ? "var(--erp-danger)" : "var(--erp-text-muted)" }}
        >
          {isCollection ? "-" : `${row.isReturn ? "-" : ""}${formatNumber(row.taxAmount)}`}
        </td>
        <td style={colStyle("invoiceStatus")} onClick={(e) => canQuickIssue && e.stopPropagation()}>
          {isCollection ? (
            "-"
          ) : row.invoiceStatus === "issued" ? (
            <span className="erp-u-bold erp-u-color-success">✓ 발행</span>
          ) : canQuickIssue ? (
            // 아이콘(₩ 표시)으로는 "세금계산서"라는 걸 못 알아보겠다는
            // 지적 — 글자로 바로 보여준다. 상태 그대로("미발행")
            // 두고 바로 옆에 실제 동작을 적은 링크를 붙인다. 이 칸(폭
            // 76px, 헤더 "계산서발행")은 좁아서 "세금계산서 작성"이
            // 끼이던 걸, 컬럼 헤더가 이미 맥락을 주므로 "작성" 두 글자로
            // 줄였다 — 폭 제약 없는 매출 상세 페이지의 같은 문구는
            // 그대로 "세금계산서 작성" 유지(다른 자리, 다른 판단).
            <span className="erp-u-items-center erp-u-gap-6 erp-u-inline-flex">
              <GridBadge tone="warn">미발행</GridBadge>
              <Link
                href={`/sales/${row.orderId}/tax-invoice`}
                style={{ color: "var(--erp-primary)", fontWeight: 700, textDecoration: "underline" }}
              >
                작성
              </Link>
            </span>
          ) : (
            <GridBadge tone="warn">미발행</GridBadge>
          )}
        </td>
        <td style={colStyle("remark", { color: "var(--erp-text-muted)" })}>
          {row.remark || "-"}
        </td>
        <td className="num" onClick={(e) => e.stopPropagation()}>
          <div className="erp-u-flex erp-u-gap-2 erp-u-justify-end">
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
                title="명세표 조회"
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
  }

  // 표의 renderRow와 같은 데이터로 모바일 카드 한 장을 그린다 — 핵심
  // 정보(날짜·거래처·품목/규격·수량·금액)만 보여주고 전표번호/작성자/
  // 세액/비고 등은 상세 화면으로 넘긴다(사용자 승인 — "나머진 뭐 상세로
  // 가도되고"). 표와 똑같이 compactDate(전월 이월분)와 isReturn/
  // isSample/isCollection 분기를 그대로 따른다.
  function renderMobileCard(row: SalesRow, opts: { selectable: boolean; compactDate?: boolean }) {
    const isCollection = row.kind === "collection";
    const isRowSelected = opts.selectable && !!row.orderId && selected.has(row.orderId);
    const detailHref = row.orderId
      ? `/sales/${row.orderId}${backParam ? `?back=${backParam}` : ""}`
      : row.customerId
        ? `/customers/${row.customerId}?back=${buildBackHref(resolveListHref("/sales", backParam))}`
        : null;
    const dateLabel = row.date
      ? opts.compactDate || rowDay(row.date) === "future"
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
                aria-label={`${row.customerName ?? ""} 선택`}
              />
              <span className="erp-row-card-partner">{row.customerName ?? "-"}</span>
            </label>
          ) : (
            <span className="erp-row-card-partner">{row.customerName ?? "-"}</span>
          )}
          <span className="erp-row-card-date">
            {dateLabel}
            {row.isCarryover && row.date && (
              <GridBadge tone="warn" style={{ marginLeft: 4 }}>
                이월
              </GridBadge>
            )}
          {rowDay(row.date) === "future" && (
            <GridBadge tone="muted" style={{ marginLeft: 4 }}>
              예약
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
            {isCollection ? "-" : `${row.isReturn ? "+" : ""}${formatNumber(row.quantity)} ${row.unit ?? ""}`}
          </span>
          <span
            className="erp-row-card-amount"
            style={row.isReturn ? { color: "var(--erp-danger)" } : undefined}
          >
            {row.isReturn ? "-" : ""}
            {formatNumber(row.supplyAmount)}원
          </span>
        </div>
        <div className="erp-row-card-badges">
          <GridBadge tone={isCollection ? "muted" : row.isReturn ? "danger" : row.isSample ? "warn" : "info"}>
            {isCollection ? "수금" : row.isReturn ? "반품" : row.isSample ? "샘플" : "매출"}
          </GridBadge>
          {!isCollection &&
            (row.invoiceStatus === "issued" ? (
              <GridBadge tone="ok">계산서 발행</GridBadge>
            ) : (
              <GridBadge tone="muted">계산서 미발행</GridBadge>
            ))}
        </div>
      </>
    );

    if (!detailHref || (opts.selectable && mobileSelectMode)) {
      return (
        <div key={row.key} className={`erp-row-card${isRowSelected ? " selected" : ""}${rowDayClass(rowDay(row.date))}${row.isCarryover ? " row-carryover" : ""}`}>
          {body}
        </div>
      );
    }
    return (
      <Link key={row.key} href={detailHref} className={`erp-row-card${rowDayClass(rowDay(row.date))}${row.isCarryover ? " row-carryover" : ""}`}>
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
          warningText="선택한 매출 건을 삭제하면 재고 수량이 자동으로 되돌아갑니다. 되돌릴 수 없습니다."
          confirmText={confirmText}
          onConfirmTextChange={setConfirmText}
        />
      )}

      <GridToolbar total={sortedRows.length} selectedCount={selected.size}>
        <ColumnVisibilityMenu options={SALES_HIDEABLE_COLUMNS} isHidden={isHidden} onToggle={toggleColumn} />
      </GridToolbar>

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
              {sortableHeader("거래일자", "date", thSticky2)}
              <th style={colStyle("docNo", { width: 90 })}>전표번호</th>
              <th style={colStyle("customerCode", { width: 76 })}>거래처코드</th>
              <th style={colStyle("kind", { width: 64 })}>유형</th>
              <th style={colStyle("taxType", { width: 60 })}>과세구분</th>
              <th style={colStyle("evidenceType", { width: 90 })}>증빙유형</th>
              {sortableHeader("출고처", "customerName")}
              <th style={colStyle("deliveryMethod", { width: 76 })}>배송방법</th>
              {sortableHeader("작성자", "authorName", colStyle("authorName"))}
              <th>품목명 / 적요</th>
              <th style={colStyle("spec")}>규격</th>
              <th style={colStyle("lotNumber")}>관리번호</th>
              {sortableHeader("수량", "quantity", undefined, "num")}
              <th className="num" style={colStyle("unitPrice")}>공급가</th>
              {sortableHeader("공급가액", "supplyAmount", undefined, "num")}
              {sortableHeader("세액", "taxAmount", undefined, "num")}
              <th style={colStyle("invoiceStatus", { width: 76 })}>계산서발행</th>
              <th style={colStyle("remark")}>비고</th>
              <th style={{ width: GRID_ACTION_COL_WIDTH }} />
            </tr>
          </thead>
          {carryoverRows && carryoverRows.length > 0 && (
            <tbody>
              <tr>
                <td className="erp-u-bold erp-u-muted erp-u-bg-page erp-u-pad-6-8"
                  colSpan={20}
                >
                  전월 이월분 · 이번달 실적으로 반영됨
                </td>
              </tr>
              {carryoverRows.map((row) => renderRow(row, { selectable: false, compactDate: true }))}
              <tr>
                <td colSpan={2} style={stickyFooterStyle(0)} />
                <td className="erp-u-muted erp-u-text-xs erp-u-pad-4-8"
                  colSpan={11}
                >
                  전월 이월 소계 ({carryoverRows.length}건)
                </td>
                <td className="num erp-u-muted erp-u-text-xs">
                  {formatNumber(carryoverQuantity ?? 0)}
                </td>
                <td />
                <td className="num erp-u-muted erp-u-text-xs">
                  {formatNumber(carryoverSupply ?? 0)}
                </td>
                <td className="num erp-u-muted erp-u-text-xs">
                  {formatNumber(carryoverTax ?? 0)}
                </td>
                <td />
                <td />
                <td />
              </tr>
            </tbody>
          )}
          <tbody>
            {sortedRows.map((row) => (
              <Fragment key={row.key}>
                {renderRow(row, { selectable: true })}
                {row.key === activeKey && (
                  <tr className="erp-grid-accordion-row">
                    {/* 20 = 표 전체 칸 수(위 carryover 구분줄의 colSpan과 동일) —
                        품목내역 패널을 그 행 바로 아래에 가로로 꽉 채워 펼친다.
                        높이 제한/내부 스크롤 없이 OrderDetailPanel 전체를 그대로
                        보여준다(사용자 요청 — 제자리 펼침, 스크롤 없이 한눈에).
                        패딩/배경/카드 테두리는 .erp-grid-accordion-row CSS가 맡는다
                        (인셋 카드 스타일 — erp-theme.css 참고). */}
                    <td colSpan={20}>
                      <OrderDetailPanel
                        selection={activeSelection}
                        priceLabel="공급가"
                        emptyMessage="품목내역이 없습니다."
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
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
              <tr className="erp-u-bold erp-u-bg-page">
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
                <td className="num">{formatNumber(totalQuantity)}</td>
                <td />
                <td className="num">{formatNumber(totalSupply)}</td>
                <td className="num">{formatNumber(totalTax)}</td>
                <td />
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
        <ErpSelect
          ariaLabel="정렬"
          placeholder="정렬"
          value={mobileSortCmd}
          onChange={(v) => {
            const [key, dir] = v.split(":") as [SortKey, "1" | "-1"];
            applySort(key, dir === "1" ? 1 : -1);
            setMobileSortCmd("");
          }}
          options={[
            { value: "date:-1", label: "최신순" },
            { value: "date:1", label: "오래된순" },
            { value: "supplyAmount:-1", label: "금액 높은순" },
            { value: "supplyAmount:1", label: "금액 낮은순" },
            { value: "customerName:1", label: "거래처순" },
          ]}
        />
      </div>
      <div className="erp-row-card-list">
        {carryoverRows && carryoverRows.length > 0 && (
          <>
            <div className="erp-u-bold erp-u-muted erp-u-text-xs">
              전월 이월분 · 이번달 실적으로 반영됨
            </div>
            {carryoverRows.map((row) => renderMobileCard(row, { selectable: false, compactDate: true }))}
          </>
        )}
        {sortedRows.map((row) => renderMobileCard(row, { selectable: true }))}
        {!sortedRows.length && <p className="erp-grid-empty">조건에 맞는 판매 거래가 없습니다.</p>}
      </div>
    </>
  );
}
