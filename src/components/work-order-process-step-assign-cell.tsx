"use client";

import { useActionState, useRef, useState } from "react";
import { assignWorkOrderProcessStep, createAndAssignSubcontractor } from "@/app/(dashboard)/production/actions";
import { PortalAccountForm } from "@/components/portal-account-form";
import { FormMessage } from "@/components/form-message";

const NEW_OPTION = "__new__";

// 업체 등록(하청업체관리) · 공정 배정 · 포털 계정 발급이 서로 다른
// 화면에 나뉘어 있어 헷갈린다는 지적으로, 생산지시 상세의 이 한 칸에서
// 셋 다 끝낼 수 있게 묶는다 — 목록에 없는 업체면 그 자리에서 등록하고
// 바로 배정하고, 아직 포털 계정이 없으면 그 자리에서 발급까지 한다.
export function WorkOrderProcessStepAssignCell({
  id,
  workOrderId,
  subcontractorId,
  hasPortalAccount,
  subcontractors,
}: {
  id: string;
  workOrderId: string;
  subcontractorId: string | null;
  hasPortalAccount: boolean;
  subcontractors: { id: string; name: string }[];
}) {
  const [mode, setMode] = useState<"select" | "new" | "issue">("select");
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
      <form action={createAction} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="work_order_id" value={workOrderId} />
        <div style={{ display: "flex", gap: 4 }}>
          <input
            name="name"
            autoComplete="off"
            placeholder="업체명"
            required
            className="erp-input"
            style={{ height: 22, fontSize: 11, padding: "0 6px", width: 100 }}
          />
          <button type="submit" className="erp-btn" style={{ height: 22, padding: "1px 6px", fontSize: 11 }} disabled={createPending}>
            {createPending ? "..." : "등록·배정"}
          </button>
          <button
            type="button"
            className="erp-btn"
            style={{ height: 22, padding: "1px 6px", fontSize: 11 }}
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
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <PortalAccountForm targetId={subcontractorId} kind="subcontractor" />
        <button
          type="button"
          className="erp-btn"
          style={{ height: 22, padding: "1px 6px", fontSize: 11, alignSelf: "flex-start" }}
          onClick={() => setMode("select")}
        >
          닫기
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <form ref={assignFormRef} action={assignAction} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="work_order_id" value={workOrderId} />
        <select
          name="subcontractor_id"
          defaultValue={subcontractorId ?? ""}
          className="erp-select"
          style={{ height: 22, fontSize: 11, padding: "0 4px" }}
          onChange={(e) => {
            if (e.target.value === NEW_OPTION) {
              setMode("new");
              return;
            }
            assignFormRef.current?.requestSubmit();
          }}
          disabled={assignPending}
          aria-label="담당 배정"
        >
          <option value="">사내 공정</option>
          {subcontractors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value={NEW_OPTION}>+ 새 업체 등록...</option>
        </select>
      </form>
      <FormMessage state={assignState} />
      {subcontractorId && !hasPortalAccount && (
        <button
          type="button"
          className="erp-badge erp-badge-warning"
          style={{ border: "none", cursor: "pointer", width: "fit-content" }}
          onClick={() => setMode("issue")}
        >
          포털 계정 없음 · 발급하기
        </button>
      )}
    </div>
  );
}
