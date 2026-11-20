"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClickableRow } from "@/components/clickable-row";
import { RowNoCell, RowNoHead } from "@/components/grid/row-no-cell";
import { DetailSideShell, type SideContent } from "@/components/grid/detail-side-shell";
import { SheetColumnMenu, SortableTh } from "@/components/grid/sheet-parts";
import { useBulkDelete } from "@/components/erp/use-bulk-delete";
import type { FormState } from "@/components/form-message";
import { useSideSplit } from "@/lib/erp-theme-features";
import { startRouteProgress } from "@/lib/route-progress";
import { useRowKeyboard, useSheetTable, type CellValue } from "@/lib/use-sheet-table";

export type RecordColumn = { label: string; num?: boolean };
export type RecordRow = {
  id: string;
  /** 표 칸 — columns와 같은 순서. 서버 화면이 칸 내용(뱃지 등)을 미리 그려서 넘긴다. */
  cells: ReactNode[];
  /** 정렬·복사에 쓰는 칸 값(columns와 같은 순서). 주면 그 열이 정렬 가능해지고, 숫자는 숫자로 비교한다. */
  values?: CellValue[];
  /** 오른쪽 상세 패널 내용(목록이 이미 가진 값) — 수정·상세는 href(모달)로 연다. */
  panel: SideContent;
  /** 행 상세 주소(C형 모달 가로채기 경로). 패널이 없는 좁은 화면에서는 행 클릭이 이 주소로 이동한다. */
  href: string;
  /** 좁은 화면 카드. */
  card: { title: ReactNode; sub?: ReactNode; foot?: ReactNode };
};

// A형(업무 목록)의 일반형 — 표 + 오른쪽 340px 패널. 행 클릭=패널, 수정·상세는 패널 버튼(모달). 견적서·구매요청·지급결의처럼
// 서버에서 행을 만들어 넘기는 화면이 같이 쓴다(개발헌법 12번). 스프레드시트 동작(열 정렬·열 설정·↑↓ 행 이동·Ctrl+C 복사)은 공용 훅.
export function RecordListA({
  columns,
  rows,
  panelAriaLabel,
  panelEmptyText,
  emptyMessage,
  bulkDelete,
}: {
  columns: RecordColumn[];
  rows: RecordRow[];
  panelAriaLabel: string;
  panelEmptyText: string;
  emptyMessage: string;
  /** 주면 맨 앞에 체크박스 칸이 생기고 선택 일괄삭제(확인 코드)가 켜진다. */
  bulkDelete?: { action: (state: FormState, formData: FormData) => Promise<FormState>; warningText: string; labelOf: (id: string) => string };
}) {
  const sideSplit = useSideSplit();
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sortable = rows.some((r) => r.values);
  const { ordered, sort, toggleSort, widths, setWidth, hidden, toggleHidden, isVisible, ariaSort } = useSheetTable(rows, (r, c) => r.values?.[c]);
  const active = ordered.find((r) => r.id === activeId) ?? null;
  const noopAction = async () => undefined;
  const { selected, toggle, bar } = useBulkDelete(
    bulkDelete?.action ?? noopAction,
    rows.map((r) => ({ id: r.id, label: bulkDelete?.labelOf(r.id) ?? r.id })),
    bulkDelete?.warningText ?? "",
  );
  const onKeyDown = useRowKeyboard(
    ordered.map((r) => r.id),
    activeId,
    setActiveId,
    (id) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      startRouteProgress();
      router.push(row.href);
    },
    (id) => (rows.find((r) => r.id === id)?.values ?? []).filter((v) => v !== null && v !== undefined).join("\t"),
  );
  const visibleCount = columns.filter((_, i) => isVisible(i)).length;

  return (
    <>
      {bulkDelete && bar}
      <div className="erp-u-flex erp-u-justify-end erp-u-mb-8">
        <SheetColumnMenu labels={columns.map((c) => c.label)} hidden={hidden} onToggle={toggleHidden} />
      </div>
      <div className={sideSplit ? "erp-master-detail" : undefined}>
        <div className={sideSplit ? "erp-master-detail-main" : undefined}>
          <div className="erp-grid-wrap has-card-view erp-sheet" tabIndex={0} onKeyDown={onKeyDown} aria-label="목록 — 위아래 방향키로 행 이동, Enter로 열기, Ctrl+C로 행 복사">
            <table className="erp-grid">
              <thead>
                <tr>
                  <RowNoHead checkbox={bulkDelete ? <span aria-hidden /> : undefined} />
                  {columns.map((c, i) =>
                    !isVisible(i) ? null : sortable ? (
                      <SortableTh key={c.label} label={c.label} col={i} sort={sort} ariaSort={ariaSort(i)} onSort={toggleSort} num={c.num} width={widths[i]} onResize={(px) => setWidth(i, px)} />
                    ) : (
                      <th key={c.label} className={c.num ? "num" : undefined}>
                        {c.label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {ordered.map((r, i) => (
                  <ClickableRow
                    key={r.id}
                    href={r.href}
                    className={activeId === r.id ? "master-active" : undefined}
                    onActivate={sideSplit ? () => setActiveId(r.id) : undefined}
                  >
                    <RowNoCell
                      n={i + 1}
                      checkbox={bulkDelete ? <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`${bulkDelete.labelOf(r.id)} 선택`} /> : undefined}
                    />
                    {r.cells.map((cell, ci) =>
                      isVisible(ci) ? (
                        <td key={ci} className={columns[ci]?.num ? "num" : undefined}>
                          {cell}
                        </td>
                      ) : null,
                    )}
                  </ClickableRow>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={visibleCount + 2} className="erp-grid-empty">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {sideSplit && <DetailSideShell ariaLabel={panelAriaLabel} emptyText={panelEmptyText} content={active?.panel ?? null} />}
      </div>

      <div className="erp-row-card-list">
        {ordered.map((r) => (
          <Link key={r.id} href={r.href} className="erp-row-card">
            <div className="erp-row-card-head">{r.card.title}</div>
            {r.card.sub && <div className="erp-u-muted erp-u-text-compact">{r.card.sub}</div>}
            {r.card.foot && <div className="erp-row-card-foot">{r.card.foot}</div>}
          </Link>
        ))}
        {!rows.length && <p className="erp-grid-empty">{emptyMessage}</p>}
      </div>
    </>
  );
}
