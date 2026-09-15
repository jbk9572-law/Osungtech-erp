"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { OrgChartApproverPicker, type PickedPerson } from "@/components/org-chart-approver-picker";
import type { OrgDepartmentNode } from "@/lib/org-chart";

export function ApprovalLinePresetForm({
  action,
  orgTree,
  submitLabel,
  initial,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  orgTree: OrgDepartmentNode[];
  submitLabel: string;
  initial?: { id: string; name: string; approvers: PickedPerson[]; references: PickedPerson[] };
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [name, setName] = useState(initial?.name ?? "");
  const [approvers, setApprovers] = useState<PickedPerson[]>(initial?.approvers ?? []);
  const [references, setReferences] = useState<PickedPerson[]>(initial?.references ?? []);

  return (
    <form action={formAction} onKeyDown={preventEnterSubmit} className="grid grid-cols-1 gap-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {approvers.map((a) => (
        <input key={a.id} type="hidden" name="approver_id" value={a.id} />
      ))}
      {references.map((r) => (
        <input key={r.id} type="hidden" name="reference_id" value={r.id} />
      ))}

      <div className="erp-field" style={{ maxWidth: 360 }}>
        <label htmlFor="alp-name">결재선 이름</label>
        <input
          id="alp-name"
          type="text"
          name="name"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="erp-input w-full"
          placeholder="예: 구매품의 결재선"
          required
        />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--erp-text)" }}>
          결재자 · 참조자 선택
        </p>
        <OrgChartApproverPicker
          tree={orgTree}
          approvers={approvers}
          references={references}
          onChangeApprovers={setApprovers}
          onChangeReferences={setReferences}
        />
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending || approvers.length === 0} className="erp-btn erp-btn-primary">
          {pending ? "저장 중..." : submitLabel}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
