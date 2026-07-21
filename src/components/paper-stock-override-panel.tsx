"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

export type PaperStockOverrideEntry = {
  id: string;
  auto_quantity: number;
  override_quantity: number;
  note: string | null;
  created_at: string;
  reverted_at: string | null;
  profiles?: { full_name: string | null } | null;
};

export function PaperStockOverridePanel({
  orderId,
  idFieldName,
  overrideAction,
  revertAction,
  history,
}: {
  orderId: string;
  idFieldName: "sales_order_id" | "purchase_order_id";
  overrideAction: (state: FormState, formData: FormData) => Promise<FormState>;
  revertAction: (state: FormState, formData: FormData) => Promise<FormState>;
  history: PaperStockOverrideEntry[];
}) {
  const [state, formAction, pending] = useActionState(overrideAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [revertPending, startRevertTransition] = useTransition();

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const activeOverride = history.find((h) => !h.reverted_at) ?? null;

  return (
    <div className="mt-2">
      {activeOverride && (
        <div
          className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded p-2 text-xs"
          style={{ background: "#fff7e6", border: "1px solid #ffd591" }}
        >
          <span>
            수동값 적용 중: <strong>{Number(activeOverride.override_quantity).toLocaleString()}연</strong>{" "}
            (자동값 {Number(activeOverride.auto_quantity).toLocaleString()}연)
            {activeOverride.note ? ` · ${activeOverride.note}` : ""}
          </span>
          <button
            type="button"
            className="erp-btn erp-btn-danger"
            style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11.5 }}
            disabled={revertPending}
            onClick={() => {
              if (!confirm("자동 계산값으로 되돌리시겠습니까?")) return;
              const formData = new FormData();
              formData.set(idFieldName, orderId);
              startRevertTransition(() => {
                revertAction(undefined, formData);
              });
            }}
          >
            자동값으로 되돌리기
          </button>
        </div>
      )}

      <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name={idFieldName} value={orderId} />
        <input
          name="override_quantity"
          type="number"
          step="0.1"
          min="0"
          placeholder="수동 수량(연)"
          required
          className="erp-input"
          style={{ width: 120 }}
        />
        <input
          name="note"
          type="text"
          placeholder="사유 (예: 거래처 협의로 3연 처리)"
          className="erp-input"
          style={{ flex: 1, minWidth: 160 }}
        />
        <button type="submit" disabled={pending} className="erp-btn">
          {pending ? "적용 중..." : "수동값 적용"}
        </button>
      </form>
      <FormMessage state={state} />

      {history.length > 0 && (
        <div className="mt-2 flex flex-col gap-1" style={{ color: "var(--erp-text-muted)", fontSize: 11.5 }}>
          <div style={{ fontWeight: 600 }}>배치로그</div>
          {history.map((h) => (
            <div key={h.id}>
              {new Date(h.created_at).toLocaleString("ko-KR")} · {h.profiles?.full_name ?? "-"} ·{" "}
              {Number(h.auto_quantity).toLocaleString()}연 → {Number(h.override_quantity).toLocaleString()}연
              {h.note ? ` (${h.note})` : ""}
              {h.reverted_at ? " · 되돌림" : " · 적용 중"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
