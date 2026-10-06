"use client";

import { useActionState } from "react";
import { updateWorkOrderProcessStep } from "@/app/(dashboard)/production/actions";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { FormMessage } from "@/components/form-message";

type StepStatus = "pending" | "received" | "in_progress" | "done" | "shipped" | "returned";

// 사내공정/업체(하청) 공통 LOT 생명주기 — 입고확인 -> 작업시작 -> 완료 ->
// 출고. "출고"는 완제품 출하가 아니라 이 LOT이 다음 공정/다음 업체로
// 넘어갔다는 뜻이다(예: 우리->C업체, 또는 C업체->우리). "반품됨"은 입고
// 전 외주검사반품으로 종료된 단계(reject_step_defect_hold)로, 더 이상
// 진행되지 않는 종단 상태다.
const STATUS_LABEL: Record<StepStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "입고 대기", tone: "muted" },
  received: { label: "입고완료", tone: "info" },
  in_progress: { label: "작업중", tone: "warn" },
  done: { label: "완료", tone: "ok" },
  shipped: { label: "출고완료", tone: "ok" },
  returned: { label: "반품됨", tone: "danger" },
};

const NEXT_STATUS: Record<StepStatus, StepStatus | null> = {
  pending: "received",
  received: "in_progress",
  in_progress: "done",
  done: "shipped",
  shipped: null,
  returned: null,
};

const NEXT_ACTION_LABEL: Record<StepStatus, string> = {
  pending: "입고확인",
  received: "작업시작",
  in_progress: "완료",
  done: "출고",
  shipped: "",
  returned: "",
};

export function WorkOrderProcessStepActions({
  id,
  workOrderId,
  status,
  defectHold = false,
}: {
  id: string;
  workOrderId: string;
  status: StepStatus;
  defectHold?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateWorkOrderProcessStep, undefined);
  const next = NEXT_STATUS[status];
  const blocked = defectHold && next === "in_progress";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <GridBadge tone={defectHold ? "danger" : STATUS_LABEL[status].tone}>
        {defectHold ? "입고 불량 보류" : STATUS_LABEL[status].label}
      </GridBadge>
      {next && !blocked && (
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
