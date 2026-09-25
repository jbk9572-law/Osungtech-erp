"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useFormRedirect } from "@/lib/use-form-redirect";
import { OrgChartApproverPicker, type PickedPerson } from "@/components/org-chart-approver-picker";
import type { OrgDepartmentNode } from "@/lib/org-chart";

// 공문을 결재선에 태우는 화면 — 전자결재 기안서 작성 화면
// (approval-document-form.tsx)의 결재선 선택 부분과 완전히 같은 컴포넌트
// (OrgChartApproverPicker)를 재사용한다. 공문은 이미 본문/수신처가 다
// 정해진 뒤(작성중 상태)에 상신하므로, 여기서는 결재선만 고른다.
export function OfficialDocumentSubmitForm({
  action,
  officialDocumentId,
  orgTree,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  officialDocumentId: string;
  orgTree: OrgDepartmentNode[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  useFormRedirect(state);

  const [approvers, setApprovers] = useState<PickedPerson[]>([]);
  const [references, setReferences] = useState<PickedPerson[]>([]);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="official_document_id" value={officialDocumentId} />
      {approvers.map((a) => (
        <input key={a.id} type="hidden" name="approver_id" value={a.id} />
      ))}
      {references.map((r) => (
        <input key={r.id} type="hidden" name="reference_id" value={r.id} />
      ))}

      <OrgChartApproverPicker
        tree={orgTree}
        approvers={approvers}
        references={references}
        onChangeApprovers={setApprovers}
        onChangeReferences={setReferences}
      />

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending || approvers.length === 0} className="erp-btn erp-btn-primary">
          {pending ? "상신 중..." : "결재 상신"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
