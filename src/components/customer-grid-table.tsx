"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { ClickableRow } from "@/components/clickable-row";
import type { FormState } from "@/components/form-message";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { bulkDeleteCustomers } from "@/app/(dashboard)/customers/actions";
import { useSortableRows } from "@/lib/grid-sort";
import { SortableTh } from "@/components/grid/sortable-th";
import { stickyHeaderStyle, stickyCellStyle, GRID_CHECKBOX_WIDTH } from "@/lib/grid-sticky";
import { GridBadge } from "@/components/grid/badge";
import { dashOrLeftAlign } from "@/lib/dash-align";

export type CustomerRow = {
  id: string;
  name: string;
  business_number: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  document_type: string;
};

type SortKey = "name" | "business_number" | "contact_name" | "phone" | "email" | "address";

const STICKY_WIDTH = 160;

export function CustomerGridTable({ rows }: { rows: CustomerRow[] }) {
  const { sortedRows, toggleSort, sortIndicator, ariaSortFor } = useSortableRows<CustomerRow, SortKey>(rows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(bulkDeleteCustomers, undefined);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setSelected(new Set());
      setConfirmText("");
    }
  }

  const selectedNames = rows.filter((r) => selected.has(r.id)).map((r) => r.name);
  const namePreview =
    selectedNames.length > 3
      ? `${selectedNames.slice(0, 3).join(", ")} 외 ${selectedNames.length - 3}건`
      : selectedNames.join(", ");

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function sortableHeader(label: string, key: SortKey, style?: CSSProperties) {
    return (
      <SortableTh
        label={`${label}${sortIndicator(key)}`}
        ariaSortValue={ariaSortFor(key)}
        onClick={() => toggleSort(key)}
        style={style}
      />
    );
  }

  const thCheckbox = stickyHeaderStyle(0, GRID_CHECKBOX_WIDTH);
  const tdCheckbox = stickyCellStyle(0, GRID_CHECKBOX_WIDTH);
  const thName = stickyHeaderStyle(GRID_CHECKBOX_WIDTH, STICKY_WIDTH, {
    borderRight: "1px solid var(--erp-border)",
  });
  const tdName = stickyCellStyle(GRID_CHECKBOX_WIDTH, STICKY_WIDTH, {
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
          warningText="출고처 삭제는 되돌릴 수 없습니다. 관련 매출 내역이 있으면 삭제되지 않습니다."
          confirmText={confirmText}
          onConfirmTextChange={setConfirmText}
        />
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={thCheckbox}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
              </th>
              {sortableHeader("출고처명", "name", thName)}
              {sortableHeader("사업자번호", "business_number")}
              {sortableHeader("담당자", "contact_name")}
              {sortableHeader("연락처", "phone")}
              {sortableHeader("이메일", "email")}
              {sortableHeader("주소", "address")}
              <th>발행 문서</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((customer) => {
              const isRowSelected = selected.has(customer.id);
              return (
                <ClickableRow
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className={isRowSelected ? "selected" : undefined}
                >
                  <td style={tdCheckbox}>
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      onChange={() => toggleRow(customer.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td style={tdName}>{customer.name}</td>
                  <td style={{ color: "var(--erp-text-muted)", ...dashOrLeftAlign(customer.business_number) }}>
                    {customer.business_number ?? "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)", ...dashOrLeftAlign(customer.contact_name) }}>
                    {customer.contact_name ?? "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)", ...dashOrLeftAlign(customer.phone) }}>
                    {customer.phone ?? "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)", ...dashOrLeftAlign(customer.email) }}>
                    {customer.email ?? "-"}
                  </td>
                  <td style={{ color: "var(--erp-text-muted)", ...dashOrLeftAlign(customer.address) }}>
                    {customer.address ?? "-"}
                  </td>
                  <td>
                    <GridBadge tone={customer.document_type === "출고증" ? "muted" : "ok"}>
                      {customer.document_type}
                    </GridBadge>
                  </td>
                  <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                    수정 →
                  </td>
                </ClickableRow>
              );
            })}
            {!sortedRows.length && (
              <tr>
                <td colSpan={8} className="erp-grid-empty">
                  등록된 출고처가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
