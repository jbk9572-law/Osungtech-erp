"use client";

import { packageUnitLabel } from "@/lib/package-qty";
import { useActionState, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import type { FormState } from "@/components/form-message";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { bulkDeleteProducts } from "@/app/(dashboard)/products/actions";
import { QtyWithBoxes } from "@/components/qty-with-boxes";
import { formatNumOrDash } from "@/lib/format-num-or-dash";
import { useSortableRows } from "@/lib/grid-sort";
import { SortableTh } from "@/components/grid/sortable-th";
import { stickyHeaderStyle, stickyCellStyle, GRID_CHECKBOX_WIDTH } from "@/lib/grid-sticky";
import { GridBadge } from "@/components/grid/badge";
import { RowCheckbox } from "@/components/grid/row-checkbox";
import { formatNumber } from "@/lib/format-number";
import { ErpSelect } from "@/components/erp/erp-select";
import { GridToolbar } from "@/components/grid/grid-toolbar";
import { ROW_NO_WIDTH, useThemeFeatures } from "@/lib/erp-theme-features";
import { GridGroupHeaderRow } from "@/components/grid/group-header-row";
import { STOCK_STATUS_BADGE, isLowStock, stockStatus, type StockStatus } from "@/lib/stock-status";

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

// 안전재고 대비 재고 수준 막대 — 안전재고의 2배를 가득 찬 것으로 본다. 안전재고가 없으면(미설정) 그리지 않는다.
function StockLevelBar({ quantity, reorderPoint, low }: { quantity: number; reorderPoint: number | null; low: boolean }) {
  if (!reorderPoint || reorderPoint <= 0) return null;
  const pct = Math.max(0, Math.min(100, (quantity / (reorderPoint * 2)) * 100));
  return (
    <div className={`erp-stock-bar${low ? " is-low" : ""}`} aria-hidden="true">
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

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
  const { sortedRows, toggleSort, sortIndicator, ariaSortFor, applySort } = useSortableRows<ProductGridRow, SortKey>(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  // 모바일 카드 목록에서 "선택" 버튼을 눌렀을 때만 체크박스를 보여준다
  // (sales/purchase-grid-table.tsx와 같은 패턴). products 모드에서만 의미
  // 있다(inventory 모드는 애초에 일괄삭제가 없음).
  const [mobileSelectMode, setMobileSelectMode] = useState(false);
  // 모바일 카드 목록의 정렬 드롭다운 — 값을 고르면 그 즉시 정렬만 적용하고
  // "정렬"이라는 placeholder로 되돌아가는 명령형 select라(현재 정렬
  // 상태를 보여주는 select가 아님), 선택 후 항상 빈 문자열로 리셋한다.
  const [mobileSortCmd, setMobileSortCmd] = useState("");
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
  // 재고현황 합계 요약(표 위 도구줄) — 안전재고 이하인 품목 수와 매입가 기준 재고 총액.
  const lowCount = sortedRows.filter((r) => isLowStock(r.quantity, r.reorderPoint)).length;
  const stockValue = sortedRows.reduce((sum, r) => sum + Math.max(0, r.quantity) * (r.cost ?? 0), 0);

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

  const { rowNumbers, stockNear, stockInsights } = useThemeFeatures();
  // 재고 수준 막대·재고금액 칸·묶음 머리글은 재고현황(inventory)에서 테마 기능이 켜졌을 때만.
  const insights = stockInsights && mode === "inventory";
  // 근접 단계는 테마 기능이 켜졌을 때만 — 꺼져 있으면 클래식과 같은 두 단계(재주문 필요/정상).
  const statusOf = (r: ProductGridRow): StockStatus => {
    const s = stockStatus(r.quantity, r.reorderPoint);
    return s === "near" && !stockNear ? "ok" : s;
  };
  // 행 번호(No) 칸 — 테마 기능이 켜졌을 때만. 체크박스 다음에 고정해서 뒤따르는 고정 칸 오프셋을 밀어준다.
  const noWidth = rowNumbers ? ROW_NO_WIDTH : 0;
  const noLeft = allowBulkDelete ? GRID_CHECKBOX_WIDTH : 0;
  const thNo = stickyHeaderStyle(noLeft, noWidth);
  const tdNo = stickyCellStyle(noLeft, noWidth);
  const checkboxOffset = noLeft + noWidth;
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
  const colCount = 12 + (rowNumbers ? 1 : 0) + (insights ? 1 : 0);

  // 표의 각 행과 같은 데이터로 모바일 카드 한 장을 그린다 — 상품명/SKU/
  // 규격/단위와 재고모드의 재고수량·상태(또는 상품모드의 매입가·판매가)만
  // 보여주고 나머지(카테고리/공급처 등)는 상세 화면으로 넘긴다
  // (sales/purchase-grid-table.tsx와 같은 패턴).
  function renderMobileCard(row: ProductGridRow) {
    const status = mode === "inventory" ? statusOf(row) : "ok";
    const href = mode === "products" ? `/products/${row.id}${backParam ? `?back=${backParam}` : ""}` : `/inventory/item/${row.id}`;
    const isRowSelected = selected.has(row.id);

    const body = (
      <>
        <div className="erp-row-card-head">
          {allowBulkDelete && mobileSelectMode ? (
            <label className="erp-row-card-checkbox">
              <input
                type="checkbox"
                checked={isRowSelected}
                onChange={() => toggleRow(row.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`${row.name} 선택`}
              />
              <span className="erp-row-card-partner">{row.name}</span>
            </label>
          ) : (
            <span className="erp-row-card-partner">{row.name}</span>
          )}
          <span className="erp-row-card-date">{row.sku}</span>
        </div>
        <div className="erp-row-card-item">
          {row.spec ?? "규격 미지정"}
          {row.unit ? ` · ${row.unit}` : ""}
        </div>
        <div className="erp-row-card-foot">
          {mode === "inventory" ? (
            <>
              <span className="erp-row-card-qty">
                <QtyWithBoxes quantity={row.quantity} basePackageQty={row.basePackageQty} packUnit={row.unit} />
              </span>
              <span className="erp-row-card-amount">{formatNumOrDash(row.price)}원</span>
            </>
          ) : (
            <>
              <span className="erp-row-card-qty">매입 {formatNumOrDash(row.cost)}</span>
              <span className="erp-row-card-amount">{formatNumOrDash(row.price)}원</span>
            </>
          )}
        </div>
        {mode === "inventory" && (
          <div className="erp-row-card-badges">
            <GridBadge tone={STOCK_STATUS_BADGE[status].tone}>{STOCK_STATUS_BADGE[status].label}</GridBadge>
          </div>
        )}
      </>
    );

    if (allowBulkDelete && mobileSelectMode) {
      return (
        <div key={row.id} className={`erp-row-card${isRowSelected ? " selected" : ""}`}>
          {body}
        </div>
      );
    }
    return (
      <Link key={row.id} href={href} className="erp-row-card">
        {body}
      </Link>
    );
  }

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
      {mode === "inventory" && (
        <GridToolbar
          total={sortedRows.length}
          selectedCount={selected.size}
          stats={[
            { label: "재주문 필요", value: `${formatNumber(lowCount)}개` },
            { label: "재고 총액", value: formatNumber(stockValue) },
          ]}
        />
      )}
      <div className="erp-grid-wrap has-card-view">
        <table className="erp-grid">
        <thead>
          {/* 묶음 머리글 — 재고수량·상태·재고금액을 "재고"로 묶는다. 앞: [No]+SKU~판매가 9칸, 뒤: 상세 칸 */}
          {insights && <GridGroupHeaderRow before={(rowNumbers ? 1 : 0) + 9} span={3} after={1} label="재고" />}
          <tr>
            {allowBulkDelete && (
              <th style={thCheckbox}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
              </th>
            )}
            {rowNumbers && <th style={thNo}>No</th>}
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
                {insights && <th className="num">재고금액</th>}
              </>
            )}
            <th />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIndex) => {
            const status = mode === "inventory" ? statusOf(row) : "ok";
            const href =
              mode === "products"
                ? `/products/${row.id}${backParam ? `?back=${backParam}` : ""}`
                : `/inventory/item/${row.id}`;
            const isRowSelected = selected.has(row.id);
            return (
              <ClickableRow
                key={row.id}
                href={href}
                className={[isRowSelected ? "selected" : "", insights && status === "low" ? "erp-row-low" : ""].filter(Boolean).join(" ") || undefined}
              >
                {allowBulkDelete && (
                  <td style={tdCheckbox}>
                    <RowCheckbox
                      checked={isRowSelected}
                      onChange={() => toggleRow(row.id)}
                      label={`${row.name} 선택`}
                    />
                  </td>
                )}
                {rowNumbers && (
                  <td style={tdNo}>
                    <span className="erp-row-no">{rowIndex + 1}</span>
                  </td>
                )}
                <td style={tdSticky1}>{row.sku}</td>
                <td style={tdSticky2}>{row.name}</td>
                <td className="erp-u-muted">{row.spec ?? "-"}</td>
                <td className="erp-u-muted">{row.unit ?? "-"}</td>
                <td className="erp-u-muted">
                  {row.basePackageQty ? `1${packageUnitLabel(row.unit)} = ${formatNumber(Number(row.basePackageQty))}${row.unit ?? ""}` : "-"}
                </td>
                <td className="erp-u-muted">{row.categoryName ?? "-"}</td>
                <td className="erp-u-muted">{row.supplierName ?? "-"}</td>
                <td className="num erp-u-muted">
                  {formatNumOrDash(row.cost)}
                </td>
                <td className="num erp-u-muted">
                  {formatNumOrDash(row.price)}
                </td>
                {mode === "products" ? (
                  <td className="num erp-u-muted">
                    {formatNumOrDash(row.reorderPoint)}
                  </td>
                ) : (
                  <>
                    <td className="num">
                      <QtyWithBoxes quantity={row.quantity} basePackageQty={row.basePackageQty} packUnit={row.unit} />
                      {insights && <StockLevelBar quantity={row.quantity} reorderPoint={row.reorderPoint} low={status === "low"} />}
                    </td>
                    <td>
                      <GridBadge tone={STOCK_STATUS_BADGE[status].tone}>{STOCK_STATUS_BADGE[status].label}</GridBadge>
                    </td>
                    {insights && <td className="num erp-u-muted">{formatNumOrDash(row.cost == null ? null : Math.max(0, row.quantity) * row.cost)}</td>}
                  </>
                )}
                <td className="num erp-u-muted">
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

      <div className="erp-row-card-toolbar">
        {allowBulkDelete ? (
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
        ) : (
          <span />
        )}
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
            { value: "name:1", label: "상품명순" },
            { value: "sku:1", label: "SKU순" },
            ...(mode === "inventory"
              ? [
                  { value: "quantity:-1", label: "재고 많은순" },
                  { value: "quantity:1", label: "재고 적은순" },
                ]
              : [
                  { value: "price:-1", label: "판매가 높은순" },
                  { value: "price:1", label: "판매가 낮은순" },
                ]),
          ]}
        />
      </div>
      <div className="erp-row-card-list">
        {sortedRows.map((row) => renderMobileCard(row))}
        {!sortedRows.length && (
          <p className="erp-grid-empty">{keyword ? "검색 결과가 없습니다." : "등록된 상품이 없습니다."}</p>
        )}
      </div>
    </>
  );
}
