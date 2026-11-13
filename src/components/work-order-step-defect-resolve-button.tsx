"use client";

import { useActionState } from "react";
import { resolveStepDefectHold } from "@/app/(dashboard)/production/actions";
import { FormMessage } from "@/components/form-message";

export function WorkOrderStepDefectResolveButton({ id, workOrderId }: { id: string; workOrderId: string }) {
  const [state, formAction, pending] = useActionState(resolveStepDefectHold, undefined);

  return (
    <form className="erp-u-items-center erp-u-gap-6 erp-u-inline-flex" action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <button
        type="submit"
        className="erp-btn erp-btn-primary erp-btn-xs erp-u-pad-1-8 erp-u-text-caption"
        disabled={pending}
      >
        {pending ? "처리 중..." : "해결처리"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
