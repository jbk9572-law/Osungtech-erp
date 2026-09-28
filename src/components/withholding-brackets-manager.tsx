"use client";

import { useState } from "react";
import type { FormState } from "@/components/form-message";
import { DeleteButton } from "@/components/delete-button";
import { WithholdingBracketForm, type WithholdingBracketValues } from "@/components/withholding-bracket-form";
import { formatNumber } from "@/lib/format-number";

export function WithholdingBracketsManager({
  brackets,
  totalCount,
  upsertAction,
  deleteAction,
}: {
  brackets: WithholdingBracketValues[];
  totalCount: number;
  upsertAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
  deleteAction: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? brackets.find((b) => b.id === editingId) : undefined;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <WithholdingBracketForm
          key={editingId ?? "new"}
          action={upsertAction}
          initial={editing}
          onCancel={editing ? () => setEditingId(null) : undefined}
          onSaved={() => setEditingId(null)}
        />
      </div>

      <p className="text-xs" style={{ color: "var(--erp-text-muted)", marginBottom: 6 }}>
        전체 {formatNumber(totalCount)}구간 중 {brackets.length}개 표시 (월급여 낮은 순).{" "}
        {totalCount > brackets.length && "아래 검색으로 원하는 구간을 찾을 수 있습니다."}
      </p>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th className="num" style={{ width: 90 }}>
                월급여 이상
              </th>
              <th className="num" style={{ width: 90 }}>
                월급여 미만
              </th>
              {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
                <th key={n} className="num" style={{ width: 65 }}>
                  {n}명
                </th>
              ))}
              <th style={{ width: 130 }} />
            </tr>
          </thead>
          <tbody>
            {brackets.map((b) => (
              <tr key={b.id}>
                <td className="num">{formatNumber(b.salary_from)}</td>
                <td className="num">{b.salary_to === null ? "이상 전부" : formatNumber(b.salary_to)}</td>
                {Array.from({ length: 11 }, (_, i) => i + 1).map((n) => (
                  <td key={n} className="num">
                    {formatNumber(b[`dependents_${n}` as keyof WithholdingBracketValues] as number)}
                  </td>
                ))}
                <td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(b.id ?? null)}
                      className="erp-btn"
                      style={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
                    >
                      수정
                    </button>
                    <DeleteButton action={deleteAction} id={b.id ?? ""} confirmMessage="이 구간을 삭제하시겠습니까?" />
                  </div>
                </td>
              </tr>
            ))}
            {brackets.length === 0 && (
              <tr>
                <td colSpan={14} className="erp-grid-empty">
                  등록된 간이세액표 구간이 없습니다. 위 CSV 업로드나 구간 추가로 먼저 등록해주세요.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
