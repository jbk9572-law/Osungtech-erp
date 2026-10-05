"use client";

import { useActionState, useState } from "react";
import {
  subcontractorConfirmReceiving,
  subcontractorReportWorkDefect,
  subcontractorUpdateStepStatus,
} from "@/app/portal/(app)/assignments/actions";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { FormMessage } from "@/components/form-message";

type StepStatus = "pending" | "received" | "in_progress" | "done" | "shipped";

const STATUS_LABEL: Record<StepStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "입고 대기", tone: "muted" },
  received: { label: "입고완료", tone: "info" },
  in_progress: { label: "작업중", tone: "warn" },
  done: { label: "완료", tone: "ok" },
  shipped: { label: "출고완료", tone: "ok" },
};

export function PortalAssignmentStepActions({
  stepId,
  workOrderId,
  status,
  defectHold,
  defectQuantity,
}: {
  stepId: string;
  workOrderId: string;
  status: StepStatus;
  defectHold: boolean;
  defectQuantity: number;
}) {
  const [mode, setMode] = useState<"default" | "receiving-defect" | "work-defect">("default");
  const [receivingState, receivingAction, receivingPending] = useActionState(
    subcontractorConfirmReceiving,
    undefined,
  );
  const [workDefectState, workDefectAction, workDefectPending] = useActionState(
    subcontractorReportWorkDefect,
    undefined,
  );
  const [updateState, updateAction, updatePending] = useActionState(subcontractorUpdateStepStatus, undefined);

  const [lastReceivingState, setLastReceivingState] = useState(receivingState);
  if (receivingState !== lastReceivingState) {
    setLastReceivingState(receivingState);
    if (receivingState?.success) setMode("default");
  }
  const [lastWorkDefectState, setLastWorkDefectState] = useState(workDefectState);
  if (workDefectState !== lastWorkDefectState) {
    setLastWorkDefectState(workDefectState);
    if (workDefectState?.success) setMode("default");
  }

  if (mode === "receiving-defect") {
    return (
      <form action={receivingAction} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
        <input type="hidden" name="step_id" value={stepId} />
        <input type="hidden" name="work_order_id" value={workOrderId} />
        <input type="hidden" name="has_defect" value="true" />
        <input
          name="defect_quantity"
          type="number"
          min="1"
          step="1"
          placeholder="불량 수량"
          required
          className="erp-input"
          style={{ height: 26, fontSize: 11.5 }}
        />
        <input
          name="note"
          type="text"
          autoComplete="off"
          placeholder="불량 사유(선택)"
          className="erp-input"
          style={{ height: 26, fontSize: 11.5 }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="submit"
            className="erp-btn erp-btn-danger"
            style={{ height: 24, padding: "1px 10px", fontSize: 11 }}
            disabled={receivingPending}
          >
            {receivingPending ? "..." : "불량 보고"}
          </button>
          <button
            type="button"
            className="erp-btn"
            style={{ height: 24, padding: "1px 10px", fontSize: 11 }}
            onClick={() => setMode("default")}
          >
            취소
          </button>
        </div>
        <FormMessage state={receivingState} />
      </form>
    );
  }

  if (mode === "work-defect") {
    return (
      <form action={workDefectAction} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
        <input type="hidden" name="step_id" value={stepId} />
        <input type="hidden" name="work_order_id" value={workOrderId} />
        <input
          name="quantity"
          type="number"
          min="1"
          step="1"
          placeholder="불량 수량"
          required
          className="erp-input"
          style={{ height: 26, fontSize: 11.5 }}
        />
        <input
          name="note"
          type="text"
          autoComplete="off"
          placeholder="불량 사유(선택)"
          className="erp-input"
          style={{ height: 26, fontSize: 11.5 }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="submit"
            className="erp-btn erp-btn-danger"
            style={{ height: 24, padding: "1px 10px", fontSize: 11 }}
            disabled={workDefectPending}
          >
            {workDefectPending ? "..." : "불량 신고"}
          </button>
          <button
            type="button"
            className="erp-btn"
            style={{ height: 24, padding: "1px 10px", fontSize: 11 }}
            onClick={() => setMode("default")}
          >
            취소
          </button>
        </div>
        <FormMessage state={workDefectState} />
      </form>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <GridBadge tone={defectHold ? "danger" : STATUS_LABEL[status].tone}>
          {defectHold ? "입고 불량 보류" : STATUS_LABEL[status].label}
        </GridBadge>

        {status === "pending" && (
          <>
            <form action={receivingAction}>
              <input type="hidden" name="step_id" value={stepId} />
              <input type="hidden" name="work_order_id" value={workOrderId} />
              <input type="hidden" name="has_defect" value="false" />
              <button
                type="submit"
                className="erp-btn erp-btn-primary"
                style={{ height: 24, padding: "1px 10px", fontSize: 11 }}
                disabled={receivingPending}
              >
                {receivingPending ? "..." : "입고확인"}
              </button>
            </form>
            <button
              type="button"
              className="erp-btn erp-btn-danger"
              style={{ height: 24, padding: "1px 10px", fontSize: 11 }}
              onClick={() => setMode("receiving-defect")}
            >
              불량 신고
            </button>
          </>
        )}

        {status === "received" && !defectHold && (
          <form action={updateAction}>
            <input type="hidden" name="step_id" value={stepId} />
            <input type="hidden" name="work_order_id" value={workOrderId} />
            <input type="hidden" name="status" value="in_progress" />
            <button
              type="submit"
              className="erp-btn erp-btn-primary"
              style={{ height: 24, padding: "1px 10px", fontSize: 11 }}
              disabled={updatePending}
            >
              {updatePending ? "..." : "작업시작"}
            </button>
          </form>
        )}

        {status === "in_progress" && (
          <>
            <form action={updateAction}>
              <input type="hidden" name="step_id" value={stepId} />
              <input type="hidden" name="work_order_id" value={workOrderId} />
              <input type="hidden" name="status" value="done" />
              <button
                type="submit"
                className="erp-btn erp-btn-primary"
                style={{ height: 24, padding: "1px 10px", fontSize: 11 }}
                disabled={updatePending}
              >
                {updatePending ? "..." : "완료"}
              </button>
            </form>
            <button
              type="button"
              className="erp-btn erp-btn-danger"
              style={{ height: 24, padding: "1px 10px", fontSize: 11 }}
              onClick={() => setMode("work-defect")}
            >
              불량 신고
            </button>
          </>
        )}

        {status === "done" && (
          <form action={updateAction}>
            <input type="hidden" name="step_id" value={stepId} />
            <input type="hidden" name="work_order_id" value={workOrderId} />
            <input type="hidden" name="status" value="shipped" />
            <button
              type="submit"
              className="erp-btn erp-btn-primary"
              style={{ height: 24, padding: "1px 10px", fontSize: 11 }}
              disabled={updatePending}
            >
              {updatePending ? "..." : "출고"}
            </button>
          </form>
        )}
      </div>
      {defectQuantity > 0 && (
        <span style={{ fontSize: 11, color: "var(--erp-danger)" }}>이 공정 불량 {defectQuantity}개</span>
      )}
      <FormMessage state={updateState} />
    </div>
  );
}
