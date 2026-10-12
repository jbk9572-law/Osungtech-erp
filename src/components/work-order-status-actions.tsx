"use client";

import { useActionState, useRef, useState } from "react";
import {
  issueWorkOrderMaterials,
  issueWorkOrderMaterialsToSubcontractor,
  completeWorkOrder,
} from "@/app/(dashboard)/production/actions";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { FormMessage } from "@/components/form-message";
import { LocationAllocationModal, type MultiLocationItem } from "@/components/location-allocation-modal";
import type { LocationOption, LocationAllocationChoice } from "@/lib/location-stock-sync";

type Status = "pending" | "material_issued" | "completed" | "cancelled";

const STATUS_LABEL: Record<Status, { label: string; tone: BadgeTone }> = {
  pending: { label: "대기", tone: "muted" },
  material_issued: { label: "생산중", tone: "warn" },
  completed: { label: "완료", tone: "ok" },
  cancelled: { label: "취소", tone: "danger" },
};

// 완제품을 보관할 위치가 2곳 이상일 때만 넘어온다(1곳이면 자동 반영,
// 0곳이면 위치 추적 대상이 아닌 품목) — production/[id]/page.tsx 참고.
type CompleteLocationContext = {
  productId: string;
  productName: string;
  spec: string | null;
  unit: string;
  quantity: number;
  locations: LocationOption[];
};

export function WorkOrderStatusActions({
  id,
  status,
  firstStepIsSubcontractor = false,
  completeLocationContext,
}: {
  id: string;
  status: Status;
  firstStepIsSubcontractor?: boolean;
  completeLocationContext?: CompleteLocationContext;
}) {
  const [issueState, issueAction, issuePending] = useActionState(issueWorkOrderMaterials, undefined);
  const [issueToSubState, issueToSubAction, issueToSubPending] = useActionState(
    issueWorkOrderMaterialsToSubcontractor,
    undefined,
  );
  const [completeState, completeAction, completePending] = useActionState(completeWorkOrder, undefined);
  const completeFormRef = useRef<HTMLFormElement>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationAllocationsJson, setLocationAllocationsJson] = useState("");

  const modalItem: MultiLocationItem[] = completeLocationContext
    ? [
        {
          groupKey: id,
          productId: completeLocationContext.productId,
          productName: completeLocationContext.productName,
          spec: completeLocationContext.spec,
          unit: completeLocationContext.unit,
          quantity: completeLocationContext.quantity,
          locations: completeLocationContext.locations,
          direction: "입고",
        },
      ]
    : [];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <GridBadge tone={STATUS_LABEL[status].tone}>{STATUS_LABEL[status].label}</GridBadge>
      {status === "pending" && firstStepIsSubcontractor && (
        <form action={issueToSubAction}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="erp-btn"
            style={{ height: 22, padding: "1px 8px", fontSize: 11 }}
            disabled={issueToSubPending}
            title="1차 공정 업체에게 자재를 보내고 보유재고로 기록합니다"
          >
            {issueToSubPending ? "처리 중..." : "외주 자재출고"}
          </button>
        </form>
      )}
      {status === "pending" && !firstStepIsSubcontractor && (
        <form action={issueAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="erp-btn" style={{ height: 22, padding: "1px 8px", fontSize: 11 }} disabled={issuePending}>
            {issuePending ? "처리 중..." : "자재투입"}
          </button>
        </form>
      )}
      {status === "material_issued" && (
        <form ref={completeFormRef} action={completeAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="location_allocations" value={locationAllocationsJson} />
          <button
            type={completeLocationContext ? "button" : "submit"}
            className="erp-btn erp-btn-primary"
            style={{ height: 22, padding: "1px 8px", fontSize: 11 }}
            disabled={completePending}
            onClick={completeLocationContext ? () => setShowLocationModal(true) : undefined}
          >
            {completePending ? "처리 중..." : "생산완료"}
          </button>
        </form>
      )}
      <FormMessage state={issueState} />
      <FormMessage state={issueToSubState} />
      <FormMessage state={completeState} />
      {completeLocationContext && (
        <LocationAllocationModal
          open={showLocationModal}
          items={modalItem}
          actionLabel="입고"
          onCancel={() => setShowLocationModal(false)}
          onConfirm={(result) => {
            const choices: LocationAllocationChoice[] = result.map((r) => ({
              productId: r.productId,
              allocations: r.allocations,
            }));
            setLocationAllocationsJson(JSON.stringify(choices));
            setShowLocationModal(false);
            // state 반영(hidden input 값 갱신)이 다음 렌더에 적용된 뒤
            // 제출해야 하므로, 폼 제출은 리렌더 이후인 다음 틱으로 미룬다.
            setTimeout(() => completeFormRef.current?.requestSubmit(), 0);
          }}
        />
      )}
    </div>
  );
}
