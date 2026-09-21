"use client";

import { useActionState, useState } from "react";
import { adjustTenantPoints } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";

export type PointTransactionRow = {
  id: string;
  delta: number;
  action_type: string | null;
  reason: string | null;
  created_at: string;
};

export function TenantPointsPanel({
  tenantId,
  balance,
  transactions,
}: {
  tenantId: string;
  balance: number;
  transactions: PointTransactionRow[];
}) {
  const [state, formAction, pending] = useActionState(adjustTenantPoints, undefined);
  // 지급/차감 성공 시 사유 입력칸만 비운다 — 폼 자체를 reset()하면 방금
  // 성공한 내역이 뭐였는지 화면에서 바로 사라져 확인하기 어렵다.
  const [lastState, setLastState] = useState(state);
  const [deltaInput, setDeltaInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setDeltaInput("");
      setReasonInput("");
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <PageGuide>
        지금은 세금계산서/계산서 발행이 전부 수기 표시라 실제로 포인트가 깎이는 곳이 없습니다 — 실제 발행 API(팝빌/바로빌 등)나 알림톡/팩스 기능을 붙일 때 이 잔액을 소모하게 됩니다. 지금은 플랫폼 운영자가 수동으로 지급/차감만 할 수 있습니다.
      </PageGuide>

      <div className="mb-3 flex items-center gap-2">
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--erp-text)" }}>{balance.toLocaleString()}</span>
        <span style={{ color: "var(--erp-text-muted)" }}>포인트 보유</span>
      </div>

      <form action={formAction} className="erp-field mb-3">
        <label>지급/차감</label>
        <div className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input
            type="number"
            name="delta"
            value={deltaInput}
            onChange={(e) => setDeltaInput(e.target.value)}
            placeholder="예: 100 또는 -50"
            className="erp-input"
            style={{ width: 120 }}
            required
          />
          <input
            type="text"
            name="reason"
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            placeholder="사유 (예: 초기 무상 지급)"
            autoComplete="off"
            className="erp-input"
            style={{ width: 220 }}
            required
          />
          <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ minWidth: 0 }}>
            {pending ? "처리 중..." : "적용"}
          </button>
        </div>
        <FormMessage state={state} />
      </form>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 140 }}>일시</th>
              <th style={{ width: 80 }}>변동</th>
              <th>사유</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.created_at).toLocaleString("ko-KR")}</td>
                <td style={{ color: t.delta > 0 ? "var(--erp-success)" : "var(--erp-danger)" }}>
                  {t.delta > 0 ? `+${t.delta}` : t.delta}
                </td>
                <td>{t.reason ?? "-"}</td>
              </tr>
            ))}
            {!transactions.length && (
              <tr>
                <td colSpan={3} className="erp-grid-empty">
                  지급/차감 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
