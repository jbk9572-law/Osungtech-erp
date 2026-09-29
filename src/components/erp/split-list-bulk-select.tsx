"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(bulkDeleteAction, undefined);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setSelected(new Set());
      setConfirmText("");
    }
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

  const selectedNames = rows.filter((r) => selected.has(r.id)).map((r) => r.label);
  const namePreview =
    selectedNames.length > 3
      ? `${selectedNames.slice(0, 3).join(", ")} 외 ${selectedNames.length - 3}건`
      : selectedNames.join(", ");

  return (
    <>
      {selected.size > 0 && (
        <div style={{ margin: 8 }}>
          <BulkDeleteBar
            formAction={formAction}
            pending={pending}
            state={state}
            selectedIds={[...selected]}
            namePreview={namePreview}
            warningText={warningText}
            confirmText={confirmText}
            onConfirmTextChange={setConfirmText}
          />
        </div>
      )}
      {rows.map((row) => (
        <div
          key={row.id}
          className={`erp-split-list-row${row.active ? " active" : ""}`}
          style={{ display: "flex", alignItems: "flex-start", gap: 6 }}
        >
          <input
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => toggleRow(row.id)}
            aria-label={`${row.label} 선택`}
            style={{ marginTop: 3 }}
          />
          <Link href={row.href} style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
            {row.content}
          </Link>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
          {emptyMessage}
        </p>
      )}
    </>
  );
}
