"use client";

import { useActionState, useMemo, useState } from "react";
import { ClickableRow } from "@/components/clickable-row";
import { FormMessage, type FormState } from "@/components/form-message";
import { bulkDeleteCustomers } from "@/app/(dashboard)/customers/actions";

export type CustomerRow = {
  id: string;
  name: string;
  business_number: string | null;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  document_type: string;
};

type SortKey = "name" | "business_number" | "contact_name" | "phone" | "address";

function compareValues(a: CustomerRow, b: CustomerRow, key: SortKey): number {
  return String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "ko");
}

export function CustomerGridTable({ rows }: { rows: CustomerRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, formAction, pending] = useActionState<FormState, FormData>(bulkDeleteCustomers, undefined);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) setSelected(new Set());
  }

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => compareValues(a, b, sort.key) * sort.dir);
  }, [rows, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 1 };
      if (prev.dir === 1) return { key, dir: -1 };
      return null;
    });
  }

  function sortIndicator(key: SortKey) {
    if (!sort || sort.key !== key) return "";
    return sort.dir === 1 ? " ▲" : " ▼";
  }

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

  function sortableHeader(label: string, key: SortKey) {
    return (
      <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort(key)}>
        {label}
        {sortIndicator(key)}
      </th>
    );
  }

  return (
    <>
      {selected.size > 0 && (
        <form
          action={formAction}
          className="mb-2 flex flex-wrap items-center gap-2 rounded-sm border p-2 text-sm"
          style={{ borderColor: "var(--erp-border)", background: "var(--erp-selected)" }}
        >
          <input type="hidden" name="ids" value={JSON.stringify([...selected])} />
          <span style={{ fontWeight: 600 }}>{selected.size}건 선택됨</span>
          <button
            type="submit"
            disabled={pending}
            className="erp-btn erp-btn-danger"
            style={{ minWidth: 0 }}
            onClick={(e) => {
              if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?`)) {
                e.preventDefault();
              }
            }}
          >
            {pending ? "삭제 중..." : "선택 삭제"}
          </button>
          <FormMessage state={state} />
        </form>
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
              </th>
              {sortableHeader("출고처명", "name")}
              {sortableHeader("사업자번호", "business_number")}
              {sortableHeader("담당자", "contact_name")}
              {sortableHeader("연락처", "phone")}
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
                  <td>
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      onChange={() => toggleRow(customer.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>{customer.name}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{customer.business_number ?? "-"}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{customer.contact_name ?? "-"}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{customer.phone ?? "-"}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{customer.address ?? "-"}</td>
                  <td>
                    <span
                      className={`erp-badge ${
                        customer.document_type === "출고증" ? "erp-badge-warning" : "erp-badge-success"
                      }`}
                    >
                      {customer.document_type}
                    </span>
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
