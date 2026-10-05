"use client";

import { useActionState, useRef } from "react";
import { assignWorkOrderProcessStep } from "@/app/(dashboard)/production/actions";
import { FormMessage } from "@/components/form-message";

export function WorkOrderProcessStepAssignForm({
  id,
  workOrderId,
  subcontractorId,
  subcontractors,
}: {
  id: string;
  workOrderId: string;
  subcontractorId: string | null;
  subcontractors: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignWorkOrderProcessStep, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="work_order_id" value={workOrderId} />
      <select
        name="subcontractor_id"
        defaultValue={subcontractorId ?? ""}
        className="erp-select"
        style={{ height: 22, fontSize: 11, padding: "0 4px" }}
        onChange={() => formRef.current?.requestSubmit()}
        disabled={pending}
        aria-label="담당 배정"
      >
        <option value="">사내 공정</option>
        {subcontractors.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <FormMessage state={state} />
    </form>
  );
}
