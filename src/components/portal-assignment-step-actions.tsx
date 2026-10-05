"use client";

import { useActionState } from "react";
import { subcontractorUpdateStepStatus } from "@/app/portal/(app)/assignments/actions";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { FormMessage } from "@/components/form-message";

type StepStatus = "pending" | "in_progress" | "done" | "shipped";

const STATUS_LABEL: Record<StepStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "대기", tone: "muted" },
  in_progress: { label: "시작됨", tone: "warn" },
  done: { label: "완료", tone: "ok" },
  shipped: { label: "배송됨", tone: "info" },
};

const NEXT_STATUS: Record<StepStatus, StepStatus | null> = {
  pending: "in_progress",
  in_progress: "done",
  done: "shipped",
  shipped: null,
};

const NEXT_ACTION_LABEL: Record<StepStatus, string> = {
  pending: "시작",
  in_progress: "완료",
  done: "배송",
  shipped: "",
};

export function PortalAssignmentStepActions({
  stepId,
  workOrderId,
  status,
}: {
  stepId: string;
  workOrderId: string;
  status: StepStatus;
}) {
  const [state, formAction, pending] = useActionState(subcontractorUpdateStepStatus, undefined);
  const next = NEXT_STATUS[status];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <GridBadge tone={STATUS_LABEL[status].tone}>{STATUS_LABEL[status].label}</GridBadge>
      {next && (
        <form action={formAction}>
          <input type="hidden" name="step_id" value={stepId} />
          <input type="hidden" name="work_order_id" value={workOrderId} />
          <input type="hidden" name="status" value={next} />
          <button type="submit" className="erp-btn erp-btn-primary" style={{ height: 24, padding: "1px 10px", fontSize: 11 }} disabled={pending}>
            {pending ? "처리 중..." : `LOT ${NEXT_ACTION_LABEL[status]}`}
          </button>
        </form>
      )}
      <FormMessage state={state} />
    </div>
  );
}
