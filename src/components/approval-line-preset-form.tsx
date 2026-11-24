"use client";

import { useActionState, useRef, useState } from "react";
import { type FormState } from "@/components/form-message";
import { ModalFormSheet } from "@/components/erp/modal-form-sheet";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { OrgChartApproverPicker, type PickedPerson } from "@/components/org-chart-approver-picker";
import type { OrgDepartmentNode } from "@/lib/org-chart";
import { useFormRedirect } from "@/lib/use-form-redirect";

// 결재선(프리셋) 등록·수정 — C형 입력 모달 공용 틀(ModalFormSheet) 안에 이름 칸 + 조직도 선택기.
export function ApprovalLinePresetForm({
  action,
  orgTree,
  submitLabel,
  title = "결재선",
  initial,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  orgTree: OrgDepartmentNode[];
  submitLabel: string;
  title?: string;
  initial?: { id: string; name: string; approvers: PickedPerson[]; references: PickedPerson[] };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  useFormRedirect(state);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);
  const [name, setName] = useState(initial?.name ?? "");
  const [approvers, setApprovers] = useState<PickedPerson[]>(initial?.approvers ?? []);
  const [references, setReferences] = useState<PickedPerson[]>(initial?.references ?? []);

  return (
    <div onKeyDown={preventEnterSubmit}>
      <ModalFormSheet
        title={title}
        tabLabel={initial ? "결재선 수정" : "결재선 등록"}
        formAction={formAction}
        state={state}
        pending={pending || approvers.length === 0}
        submitRef={submitRef}
        submitLabel={`F7 ${submitLabel}`}
      >
        {initial && <input type="hidden" name="id" value={initial.id} />}
        {approvers.map((a) => (
          <input key={a.id} type="hidden" name="approver_id" value={a.id} />
        ))}
        {references.map((r) => (
          <input key={r.id} type="hidden" name="reference_id" value={r.id} />
        ))}

        <div className="erp-field erp-span-6">
          <label htmlFor="alp-name">결재선 이름</label>
          <input
            id="alp-name"
            type="text"
            name="name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="erp-input erp-u-w-full"
            placeholder="예: 구매품의 결재선"
            required
          />
        </div>

        <div className="erp-field erp-span-12">
          <label>결재자 · 참조자 선택</label>
          <OrgChartApproverPicker
            tree={orgTree}
            approvers={approvers}
            references={references}
            onChangeApprovers={setApprovers}
            onChangeReferences={setReferences}
          />
        </div>
      </ModalFormSheet>
    </div>
  );
}
