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
    <form action={formAction} style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
        className="erp-input"
        style={{ height: 22, fontSize: 11, padding: "0 6px", width: 80 }}
      />
      <button type="submit" className="erp-btn" style={{ height: 22, padding: "1px 6px", fontSize: 11 }} disabled={pending}>
        {pending ? "..." : "저장"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
