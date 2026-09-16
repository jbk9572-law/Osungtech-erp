"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { OrgChartApproverPicker, type PickedPerson } from "@/components/org-chart-approver-picker";
import type { OrgDepartmentNode } from "@/lib/org-chart";
import type { ApprovalLinePresetOption } from "@/components/approval-document-form";

export function PaymentRequestSubmitForm({
  action,
  paymentRequestId,
  orgTree,
  presets,
  profileNameById,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  paymentRequestId: string;
  orgTree: OrgDepartmentNode[];
  presets: ApprovalLinePresetOption[];
  profileNameById: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [approvers, setApprovers] = useState<PickedPerson[]>([]);
  const [references, setReferences] = useState<PickedPerson[]>([]);
  const [presetId, setPresetId] = useState("");

  function toPicked(ids: string[]): PickedPerson[] {
    return ids.map((id) => ({ id, name: profileNameById[id] ?? "구성원" }));
  }

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setApprovers(toPicked(preset.approverIds));
    setReferences(toPicked(preset.referenceIds));
  }

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="id" value={paymentRequestId} />
      {approvers.map((a) => (
        <input key={a.id} type="hidden" name="approver_id" value={a.id} />
      ))}
      {references.map((r) => (
        <input key={r.id} type="hidden" name="reference_id" value={r.id} />
      ))}

      {presets.length > 0 && (
        <div className="erp-field" style={{ maxWidth: 320 }}>
          <label htmlFor="pr-preset">저장된 결재선 불러오기</label>
          <select id="pr-preset" className="erp-input w-full" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">선택 안 함</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <OrgChartApproverPicker
        tree={orgTree}
        approvers={approvers}
        references={references}
        onChangeApprovers={setApprovers}
        onChangeReferences={setReferences}
      />

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending || approvers.length === 0} className="erp-btn erp-btn-primary">
          {pending ? "제출 중..." : "F7 제출(마감)"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
