"use client";

import { useActionState } from "react";
import { updateWorkOrderProcessStep } from "@/app/(dashboard)/production/actions";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { FormMessage } from "@/components/form-message";

type StepStatus = "pending" | "in_progress" | "done" | "shipped";

// 사내공정/업체(하청) 공통 LOT 생명주기 — 대기 -> 시작 -> 완료 -> 배송.
// "배송"은 완제품 출하가 아니라 이 LOT이 다음 공정/다음 업체로 넘어갔다는
// 뜻이다(예: 우리->C업체, 또는 C업체->우리).
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

export function WorkOrderProcessStepActions({
  id,
  workOrderId,
  status,
}: {
  id: string;
  workOrderId: string;
  status: StepStatus;
}) {
  const [state, formAction, pending] = useActionState(updateWorkOrderProcessStep, undefined);
  const next = NEXT_STATUS[status];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <GridBadge tone={STATUS_LABEL[status].tone}>{STATUS_LABEL[status].label}</GridBadge>
      {next && (
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="work_order_id" value={workOrderId} />
          <input type="hidden" name="status" value={next} />
          <button type="submit" className="erp-btn" style={{ height: 22, padding: "1px 8px", fontSize: 11 }} disabled={pending}>
            {pending ? "처리 중..." : NEXT_ACTION_LABEL[status]}
          </button>
        </form>
      )}
      <FormMessage state={state} />
    </div>
  );
}
