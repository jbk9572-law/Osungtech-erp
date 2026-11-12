"use client";

import { useActionState } from "react";
import { resolveStepDefectHold } from "@/app/(dashboard)/production/actions";
import { FormMessage } from "@/components/form-message";

export function WorkOrderStepDefectResolveButton({ id, workOrderId }: { id: string; workOrderId: string }) {
  const [state, formAction, pending] = useActionState(resolveStepDefectHold, undefined);

  return (
    <form className="erp-u-items-center erp-u-gap-6" action={formAction} style={{ display: "inline-flex" }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <button
        type="submit"
        className="erp-btn erp-btn-primary erp-u-h-22"
        style={{ padding: "1px 8px", fontSize: 11 }}
        disabled={pending}
      >
        {pending ? "처리 중..." : "해결처리"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
