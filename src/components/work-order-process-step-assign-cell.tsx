"use client";

import { useActionState, useRef, useState } from "react";
import { assignWorkOrderProcessStep, createAndAssignSubcontractor } from "@/app/(dashboard)/production/actions";
import { PortalAccountForm } from "@/components/portal-account-form";
import { FormMessage } from "@/components/form-message";
import { ErpSelect } from "@/components/erp/erp-select";

const NEW_OPTION = "__new__";

// 업체 등록(하청업체관리) · 공정 배정 · 포털 계정 발급이 서로 다른
// 화면에 나뉘어 있어 헷갈린다는 지적으로, 생산지시 상세의 이 한 칸에서
// 셋 다 끝낼 수 있게 묶는다 — 목록에 없는 업체면 그 자리에서 등록하고
// 바로 배정하고, 아직 포털 계정이 없으면 그 자리에서 발급까지 한다.
export function WorkOrderProcessStepAssignCell({
  id,
  workOrderId,
  status,
  subcontractorId,
  hasPortalAccount,
  subcontractors,
}: {
  id: string;
  workOrderId: string;
  // 자재투입/입고 전(대기) 상태에서만 담당자를 재배정할 수 있다 — 서버
  // RPC(assign_work_order_process_step)의 가드와 같은 기준. 이미 진행
  // 중이거나 완료된 단계는 재배정 시도 시 서버 에러만 보고 끝나는 대신,
  // 여기서 아예 바꿀 수 없는 담당자 이름으로 보여준다.
  status: string;
  subcontractorId: string | null;
  hasPortalAccount: boolean;
  subcontractors: { id: string; name: string }[];
}) {
  const [mode, setMode] = useState<"select" | "new" | "issue">("select");
  const [assignValue, setAssignValue] = useState(subcontractorId ?? "");
  const [assignState, assignAction, assignPending] = useActionState(assignWorkOrderProcessStep, undefined);
  const [createState, createAction, createPending] = useActionState(createAndAssignSubcontractor, undefined);
  const assignFormRef = useRef<HTMLFormElement>(null);

  // 등록·배정 성공 시 입력폼을 닫는다 — InlineConfirmDelete와 동일한
  // "state identity 비교" 패턴(useEffect에서 setState를 직접 부르는
  // 대신 렌더 중에 이전 state와 비교해 반응한다).
  const [lastCreateState, setLastCreateState] = useState(createState);
  if (createState !== lastCreateState) {
    setLastCreateState(createState);
    if (createState?.success) setMode("select");
  }

  if (mode === "new") {
    return (
      <form className="erp-u-flex erp-u-col erp-u-gap-4" action={createAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="work_order_id" value={workOrderId} />
        <div className="erp-u-flex erp-u-gap-4">
          <input
            name="name"
            autoComplete="off"
            placeholder="업체명"
            required
            className="erp-input erp-u-h-22 erp-u-text-caption erp-u-pad-0-6"
            style={{ width: 100 }}
          />
          <button type="submit" className="erp-btn erp-btn-xs erp-u-pad-1-6 erp-u-text-caption" disabled={createPending}>
            {createPending ? "..." : "등록·배정"}
          </button>
          <button
            type="button"
            className="erp-btn erp-btn-xs erp-u-pad-1-6 erp-u-text-caption"
            onClick={() => setMode("select")}
          >
            취소
          </button>
        </div>
        <FormMessage state={createState} />
      </form>
    );
  }

  if (mode === "issue" && subcontractorId) {
    return (
      <div className="erp-u-flex erp-u-col erp-u-gap-4">
        <PortalAccountForm targetId={subcontractorId} kind="subcontractor" />
        <button
          type="button"
          className="erp-btn erp-btn-xs erp-u-pad-1-6 erp-u-text-caption"
          style={{ alignSelf: "flex-start" }}
          onClick={() => setMode("select")}
        >
          닫기
        </button>
      </div>
    );
  }

  if (status !== "pending") {
    const assignedName = subcontractorId
      ? (subcontractors.find((s) => s.id === subcontractorId)?.name ?? "업체")
      : "사내 공정";
    return (
      <div className="erp-u-flex erp-u-col erp-u-gap-4">
        <span className="erp-u-muted erp-u-text-caption" title="자재투입/입고 전(대기 상태)에만 담당자를 바꿀 수 있습니다.">
          {assignedName}
        </span>
        {subcontractorId && !hasPortalAccount && (
          <button
            type="button"
            className="erp-badge erp-badge-warning erp-u-border-none erp-u-pointer"
            style={{ width: "fit-content" }}
            onClick={() => setMode("issue")}
          >
            포털 계정 없음 · 발급하기
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="erp-u-flex erp-u-col erp-u-gap-4">
      <form className="erp-u-items-center erp-u-inline-flex erp-u-gap-4" ref={assignFormRef} action={assignAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="work_order_id" value={workOrderId} />
        <ErpSelect
          name="subcontractor_id"
          value={assignValue}
          style={{ height: 22, fontSize: 11, padding: "0 4px" }}
          onChange={(v) => {
            setAssignValue(v);
            if (v === NEW_OPTION) {
              setMode("new");
              return;
            }
            assignFormRef.current?.requestSubmit();
          }}
          disabled={assignPending}
          ariaLabel="담당 배정"
          options={[
            { value: "", label: "사내 공정" },
            ...subcontractors.map((s) => ({ value: s.id, label: s.name })),
            { value: NEW_OPTION, label: "+ 새 업체 등록..." },
          ]}
        />
      </form>
      <FormMessage state={assignState} />
      {subcontractorId && !hasPortalAccount && (
        <button
          type="button"
          className="erp-badge erp-badge-warning erp-u-border-none erp-u-pointer"
          style={{ width: "fit-content" }}
          onClick={() => setMode("issue")}
        >
          포털 계정 없음 · 발급하기
        </button>
      )}
    </div>
  );
}
