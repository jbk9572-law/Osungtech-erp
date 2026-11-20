"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ClickableRow } from "@/components/clickable-row";
import { RowNoCell, RowNoHead } from "@/components/grid/row-no-cell";
import { DetailSideShell, type SideContent } from "@/components/grid/detail-side-shell";
import { useBulkDelete } from "@/components/erp/use-bulk-delete";
import type { FormState } from "@/components/form-message";
import { useSideSplit } from "@/lib/erp-theme-features";

export type RecordColumn = { label: string; num?: boolean };
export type RecordRow = {
  id: string;
  /** 표 칸 — columns와 같은 순서. 서버 화면이 칸 내용(뱃지 등)을 미리 그려서 넘긴다. */
  cells: ReactNode[];
  /** 오른쪽 상세 패널 내용(목록이 이미 가진 값) — 수정·상세는 href(모달)로 연다. */
  panel: SideContent;
  /** 행 상세 주소(C형 모달 가로채기 경로). 패널이 없는 좁은 화면에서는 행 클릭이 이 주소로 이동한다. */
  href: string;
  /** 좁은 화면 카드. */
  card: { title: ReactNode; sub?: ReactNode; foot?: ReactNode };
};

// A형(업무 목록)의 일반형 — 표 + 오른쪽 340px 패널. 행 클릭=패널, 수정·상세는 패널 버튼(모달). 견적서·구매요청·지급결의처럼
// 서버에서 행을 만들어 넘기는 화면이 같이 쓴다(개발헌법 12번). 거래처·공급처는 체크박스 일괄삭제가 있어 PartyListA를 쓴다.
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = rows.find((r) => r.id === activeId) ?? null;
  const noopAction = async () => undefined;
  const { selected, toggle, bar } = useBulkDelete(
    bulkDelete?.action ?? noopAction,
    rows.map((r) => ({ id: r.id, label: bulkDelete?.labelOf(r.id) ?? r.id })),
    bulkDelete?.warningText ?? "",
  );

  return (
    <>
      {bulkDelete && bar}
      <div className={sideSplit ? "erp-master-detail" : undefined}>
        <div className={sideSplit ? "erp-master-detail-main" : undefined}>
          <div className="erp-grid-wrap has-card-view">
            <table className="erp-grid">
              <thead>
                <tr>
                  {bulkDelete && <th className="erp-col-check" aria-label="선택" />}
                  <RowNoHead />
                  {columns.map((c) => (
                    <th key={c.label} className={c.num ? "num" : undefined}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <ClickableRow
                    key={r.id}
                    href={r.href}
                    className={sideSplit && activeId === r.id ? "master-active" : undefined}
                    onActivate={sideSplit ? () => setActiveId(r.id) : undefined}
                  >
                    {bulkDelete && (
                      <td className="erp-col-check" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`${bulkDelete.labelOf(r.id)} 선택`} />
                      </td>
                    )}
                    <RowNoCell n={i + 1} />
                    {r.cells.map((cell, ci) => (
                      <td key={ci} className={columns[ci]?.num ? "num" : undefined}>
                        {cell}
                      </td>
                    ))}
                  </ClickableRow>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={columns.length + 1 + (bulkDelete ? 1 : 0)} className="erp-grid-empty">
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
        {rows.map((r) => (
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
