"use client";

import { useActionState } from "react";
import { setStepUnitCost } from "@/app/(dashboard)/production/actions";
import { FormMessage } from "@/components/form-message";

export function WorkOrderStepUnitCostForm({
  id,
  workOrderId,
  unitCost,
}: {
  id: string;
  workOrderId: string;
  unitCost: number | null;
}) {
  const [state, formAction, pending] = useActionState(setStepUnitCost, undefined);

  return (
    <form className="erp-u-flex erp-u-items-center erp-u-gap-4" action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <input
        name="unit_cost"
        type="number"
        min="0"
        step="1"
        autoComplete="off"
        defaultValue={unitCost ?? ""}
        placeholder="단가"
        className="erp-input erp-u-h-22 erp-u-text-caption erp-u-pad-0-6"
        style={{ width: 80 }}
      />
      <button type="submit" className="erp-btn erp-btn-xs erp-u-pad-1-6 erp-u-text-caption" disabled={pending}>
        {pending ? "..." : "저장"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
