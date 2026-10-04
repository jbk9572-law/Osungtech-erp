"use client";

import { useActionState } from "react";
import { issueWorkOrderMaterials, completeWorkOrder } from "@/app/(dashboard)/production/actions";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { FormMessage } from "@/components/form-message";

type Status = "pending" | "material_issued" | "completed" | "cancelled";

const STATUS_LABEL: Record<Status, { label: string; tone: BadgeTone }> = {
  pending: { label: "대기", tone: "muted" },
  material_issued: { label: "생산중", tone: "warn" },
  completed: { label: "완료", tone: "ok" },
  cancelled: { label: "취소", tone: "danger" },
};

export function WorkOrderStatusActions({ id, status }: { id: string; status: Status }) {
  const [issueState, issueAction, issuePending] = useActionState(issueWorkOrderMaterials, undefined);
  const [completeState, completeAction, completePending] = useActionState(completeWorkOrder, undefined);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <GridBadge tone={STATUS_LABEL[status].tone}>{STATUS_LABEL[status].label}</GridBadge>
      {status === "pending" && (
        <form action={issueAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="erp-btn" style={{ height: 22, padding: "1px 8px", fontSize: 11 }} disabled={issuePending}>
            {issuePending ? "처리 중..." : "자재투입"}
          </button>
        </form>
      )}
      {status === "material_issued" && (
        <form action={completeAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="erp-btn erp-btn-primary" style={{ height: 22, padding: "1px 8px", fontSize: 11 }} disabled={completePending}>
            {completePending ? "처리 중..." : "생산완료"}
          </button>
        </form>
      )}
      <FormMessage state={issueState} />
      <FormMessage state={completeState} />
    </div>
  );
}
