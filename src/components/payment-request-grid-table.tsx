"use client";

import { useActionState, useMemo, useState, type CSSProperties } from "react";
import { ClickableRow } from "@/components/clickable-row";
import type { FormState } from "@/components/form-message";
import { BulkDeleteBar } from "@/components/bulk-delete-bar";
import { bulkDeletePaymentRequests } from "@/app/(dashboard)/reports/payment-requests/actions";
import { dashOrLeftAlign } from "@/lib/dash-align";

export type PaymentRequestRow = {
  id: string;
  no: number;
  docTitle: string;
  department: string;
  periodFrom: string | null;
  periodTo: string | null;
  authorName: string | null;
  total: number;
  createdAt: string;
};

type SortKey = "department" | "authorName" | "total" | "createdAt";

function compareValues(a: PaymentRequestRow, b: PaymentRequestRow, key: SortKey): number {
  const av = a[key];
  const bv = b[key];
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av ?? "").localeCompare(String(bv ?? ""), "ko");
}

function formatPeriod(from: string | null, to: string | null) {
  if (!from && !to) return "-";
  const fmt = (d: string) => d.replaceAll("-", ".");
  if (from && to && from === to) return fmt(from);
  return `${from ? fmt(from) : "?"} ~ ${to ? fmt(to) : "?"}`;
}

// 기간 시작월을 색으로 구분해 목록을 훑어볼 때 몇 월 건인지 한눈에 들어오게
// 한다. 12색이 고르게 퍼지도록 30도씩 색상환을 돌려서 계산한다.
function periodStartMonth(from: string | null): number | null {
  if (!from) return null;
  const month = Number(from.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

// 색상 자체(hsl 회전)는 이 12색 팔레트에만 필요한 계산이라 인라인으로
// 남기지만, 배지의 모양(둥근 정도/패딩/글자 크기)은 앱 전역의 .erp-badge와
// 어긋나지 않도록 그 클래스를 그대로 쓰고 색상만 덮어쓴다.
function monthBadgeStyle(month: number): CSSProperties {
  const hue = (month - 1) * 30;
  return {
    justifyContent: "center",
    minWidth: 28,
    marginRight: 6,
    background: `hsl(${hue}, 70%, 92%)`,
    color: `hsl(${hue}, 55%, 32%)`,
  };
}

function PeriodCell({ from, to }: { from: string | null; to: string | null }) {
  const month = periodStartMonth(from);
  return (
    <>
      {month && (
        <span className="erp-badge" style={monthBadgeStyle(month)}>
          {month}월
        </span>
      )}
      {formatPeriod(from, to)}
    </>
  );
}

export function PaymentRequestGridTable({ rows }: { rows: PaymentRequestRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(bulkDeletePaymentRequests, undefined);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setSelected(new Set());
      setConfirmText("");
    }
  }

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => compareValues(a, b, sort.key) * sort.dir);
  }, [rows, sort]);

  const selectedNames = rows.filter((r) => selected.has(r.id)).map((r) => r.department || r.docTitle);
  const namePreview =
    selectedNames.length > 3
      ? `${selectedNames.slice(0, 3).join(", ")} 외 ${selectedNames.length - 3}건`
      : selectedNames.join(", ");

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
    const isSorted = sort?.key === key;
    return (
      <th
        className={className}
        style={extraStyle}
        aria-sort={isSorted ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}
      >
        <button type="button" onClick={() => toggleSort(key)} className="erp-th-btn">
          {label}
          {sortIndicator(key)}
        </button>
      </th>
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
          warningText="지급결의서 삭제는 되돌릴 수 없습니다. 첨부된 영수증 파일도 함께 삭제됩니다."
          confirmText={confirmText}
          onConfirmTextChange={setConfirmText}
        />
      )}
      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="전체 선택" />
              </th>
              <th className="num" style={{ width: 70 }}>
                번호
              </th>
              <th style={{ width: 150 }}>구분</th>
              {sortableHeader("부서명", "department", { width: 140 })}
              <th>기간</th>
              {sortableHeader("작성자", "authorName", { width: 110 })}
              {sortableHeader("합계", "total", { width: 130 }, "num")}
              {sortableHeader("작성일", "createdAt", { width: 100 })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const isRowSelected = selected.has(row.id);
              return (
                <ClickableRow
                  key={row.id}
                  href={`/reports/payment-requests/${row.id}`}
                  className={isRowSelected ? "selected" : undefined}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      onChange={() => toggleRow(row.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="num">{row.no}</td>
                  <td>{row.docTitle}</td>
                  <td style={dashOrLeftAlign(row.department)}>{row.department || "-"}</td>
                  <td>
                    <PeriodCell from={row.periodFrom} to={row.periodTo} />
                  </td>
                  <td>{row.authorName ?? "-"}</td>
                  <td className="num">{row.total.toLocaleString()}원</td>
                  <td>{new Date(row.createdAt).toLocaleDateString("ko-KR")}</td>
                </ClickableRow>
              );
            })}
            {!sortedRows.length && (
              <tr>
                <td colSpan={8} className="erp-grid-empty">
                  등록된 지급결의서가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
