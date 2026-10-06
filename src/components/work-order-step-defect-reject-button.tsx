"use client";

import { useActionState } from "react";
import { rejectStepDefectHold } from "@/app/(dashboard)/production/actions";
import { FormMessage } from "@/components/form-message";

export function WorkOrderStepDefectRejectButton({ id, workOrderId }: { id: string; workOrderId: string }) {
  const [state, formAction, pending] = useActionState(rejectStepDefectHold, undefined);

  return (
    <form action={formAction} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <button
        type="submit"
        className="erp-btn erp-btn-danger"
        style={{ height: 22, padding: "1px 8px", fontSize: 11 }}
        disabled={pending}
      >
        {pending ? "처리 중..." : "반품처리"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
