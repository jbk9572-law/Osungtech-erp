"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useBulkDelete } from "@/components/erp/use-bulk-delete";
import type { FormState } from "@/components/form-message";

export type SplitListBulkRow = {
  id: string;
  href: string;
  active: boolean;
  label: string;
  content: ReactNode;
};

// .erp-split-list-body 안에서 체크박스 다중 선택 + 일괄삭제를 지원하는
// 목록 — customers/suppliers/reports/payment-requests 세 화면이 원래
// *-grid-table.tsx에서 갖고 있던 BulkDeleteBar 기능을, 3분할(목록+상세)
// 전환 후에도 잃지 않도록 공용화했다. 선택 상태(useActionState 포함)는
// 여기서만 들고, 화면마다 다른 행 내용(content)만 넘겨받는다.
export function SplitListBulkSelect({
  rows,
  bulkDeleteAction,
  warningText,
  emptyMessage,
}: {
  rows: SplitListBulkRow[];
  bulkDeleteAction: (state: FormState, formData: FormData) => Promise<FormState>;
  warningText: string;
  emptyMessage: string;
}) {
  const { selected, toggle: toggleRow, bar } = useBulkDelete(bulkDeleteAction, rows, warningText);

  return (
    <>
      {bar}
      {rows.map((row) => (
        <div
          key={row.id}
          className={`erp-split-list-row erp-u-flex erp-u-items-start erp-u-gap-6${row.active ? " active" : ""}`}
        >
          <input className="erp-u-mt-3"
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => toggleRow(row.id)}
            aria-label={`${row.label} 선택`}
          />
          <Link href={row.href} style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
            {row.content}
          </Link>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="p-3 text-xs erp-u-muted">
          {emptyMessage}
        </p>
      )}
    </>
  );
}
