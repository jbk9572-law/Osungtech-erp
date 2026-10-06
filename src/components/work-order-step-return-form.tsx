"use client";

import { useActionState, useState } from "react";
import { returnWorkOrderProcessStepQuantity } from "@/app/(dashboard)/production/actions";
import { FormMessage } from "@/components/form-message";

// 입고 후 반품 — 이미 완료/출고된 외주 공정도 나중에 불량이 발견되면
// 수량을 반품 처리할 수 있다(영림원 "외주 입고 후 반품"에 해당).
export function WorkOrderStepReturnForm({ id, workOrderId }: { id: string; workOrderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(returnWorkOrderProcessStepQuantity, undefined);

  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="erp-btn"
        style={{ height: 22, padding: "1px 8px", fontSize: 11 }}
        onClick={() => setOpen(true)}
      >
        반품
      </button>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <input
        name="quantity"
        type="number"
        min="1"
        step="1"
        required
        autoComplete="off"
        placeholder="반품 수량"
        className="erp-input"
        style={{ height: 24, fontSize: 11 }}
      />
      <input
        name="note"
        type="text"
        autoComplete="off"
        placeholder="사유(선택)"
        className="erp-input"
        style={{ height: 24, fontSize: 11 }}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="submit"
          className="erp-btn erp-btn-danger"
          style={{ height: 22, padding: "1px 8px", fontSize: 11 }}
          disabled={pending}
        >
          {pending ? "..." : "반품 저장"}
        </button>
        <button type="button" className="erp-btn" style={{ height: 22, padding: "1px 8px", fontSize: 11 }} onClick={() => setOpen(false)}>
          취소
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
