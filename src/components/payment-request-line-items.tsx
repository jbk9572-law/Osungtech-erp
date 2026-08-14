"use client";

import { useState } from "react";
import { focusSameColumnNextRow } from "@/lib/grid-enter-nav";

export type LineItemRow = {
  key: string;
  usedAt: string;
  vendor: string;
  purpose: string;
  amount: string;
  remark: string;
  highlighted: boolean;
};

function emptyRow(key: string, defaultDate: string): LineItemRow {
  return { key, usedAt: defaultDate, vendor: "", purpose: "", amount: "", remark: "", highlighted: false };
}

// 지급결의서(사용내역) 회사 실제 양식 그대로 - 일자/사용처/용도/금액/비고
// 줄을 여러 개 추가/삭제할 수 있는 표. 사용카드는 줄마다가 아니라 문서
// 전체에 하나만 붙는다(신한 쓴 문서엔 신한 내역만, 하나는 하나만, 개인은
// 개인만 몰아서 작성하는 실제 방식이라 헤더 쪽에서 선택한다). 결과는
// hidden input(name="items")에 JSON으로 실어서 폼 제출 시 서버로 넘긴다.
export function PaymentRequestLineItems({
  initialRows,
  defaultDate,
}: {
  initialRows?: LineItemRow[];
  defaultDate: string;
}) {
  const [rows, setRows] = useState<LineItemRow[]>(
    initialRows && initialRows.length > 0 ? initialRows : [emptyRow("row-0", defaultDate)]
  );
  const [nextKey, setNextKey] = useState(rows.length);

  function updateRow(key: string, patch: Partial<LineItemRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow(`row-${nextKey}`, defaultDate)]);
    setNextKey((n) => n + 1);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const itemsJson = JSON.stringify(
    rows
      .filter((row) => row.usedAt && row.vendor.trim())
      .map((row, i) => ({
        usedAt: row.usedAt,
        vendor: row.vendor.trim(),
        purpose: row.purpose.trim(),
        amount: Number(row.amount) || 0,
        remark: row.remark.trim(),
        sortOrder: i,
        isHighlighted: row.highlighted,
      }))
  );

  return (
    <div className="md:col-span-4">
      <input type="hidden" name="items" value={itemsJson} />
      <div className="erp-grid-wrap" style={{ border: "1px solid var(--erp-border)" }}>
        <table className="erp-grid" style={{ tableLayout: "fixed", width: "100%", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ width: "13%" }}>일자</th>
              <th style={{ width: "21%" }}>사용처</th>
              <th style={{ width: "15%" }}>용도</th>
              <th className="num" style={{ width: "14%" }}>
                금액
              </th>
              <th style={{ width: "16%" }}>비고</th>
              <th className="num" style={{ width: "11%" }} title="인쇄 시 이 줄을 강조(음영) 표시합니다">
                강조
              </th>
              <th style={{ width: "10%" }} />
            </tr>
          </thead>
          <tbody onKeyDown={focusSameColumnNextRow}>
            {rows.map((row) => (
              <tr key={row.key} style={row.highlighted ? { background: "var(--erp-highlight-bg)" } : undefined}>
                <td>
                  <input
                    type="date"
                    value={row.usedAt}
                    onChange={(e) => updateRow(row.key, { usedAt: e.target.value })}
                    className="erp-input w-full"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.vendor}
                    onChange={(e) => updateRow(row.key, { vendor: e.target.value })}
                    placeholder="사용처"
                    className="erp-input w-full"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.purpose}
                    onChange={(e) => updateRow(row.key, { purpose: e.target.value })}
                    placeholder="주유, 식대 등"
                    className="erp-input w-full"
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    step="1"
                    value={row.amount}
                    onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                    placeholder="-"
                    className="erp-input w-full text-right"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.remark}
                    onChange={(e) => updateRow(row.key, { remark: e.target.value })}
                    className="erp-input w-full"
                  />
                </td>
                <td className="num" style={{ textAlign: "center", verticalAlign: "middle" }}>
                  <input
                    type="checkbox"
                    checked={row.highlighted}
                    onChange={(e) => updateRow(row.key, { highlighted: e.target.checked })}
                    title="인쇄 시 이 줄을 강조(음영) 표시합니다"
                    style={{ width: 16, height: 16, verticalAlign: "middle" }}
                  />
                </td>
                <td className="num">
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                    className="erp-btn erp-btn-danger"
                    style={{ minWidth: 0, height: 26, padding: "0 8px" }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" onClick={addRow} className="erp-btn">
          + 줄 추가
        </button>
        <span className="text-sm font-semibold">합계: {total.toLocaleString()}원</span>
      </div>
    </div>
  );
}
