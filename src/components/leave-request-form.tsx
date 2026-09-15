"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { OrgChartApproverPicker, type PickedPerson } from "@/components/org-chart-approver-picker";
import type { OrgDepartmentNode } from "@/lib/org-chart";
import type { ApprovalLinePresetOption } from "@/components/approval-document-form";

export function LeaveRequestForm({
  action,
  today,
  orgTree,
  presets,
  profileNameById,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  today: string;
  orgTree: OrgDepartmentNode[];
  presets: ApprovalLinePresetOption[];
  profileNameById: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

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
    <form action={formAction} onKeyDown={preventEnterSubmit} className="grid grid-cols-1 gap-3">
      {approvers.map((a) => (
        <input key={a.id} type="hidden" name="approver_id" value={a.id} />
      ))}
      {references.map((r) => (
        <input key={r.id} type="hidden" name="reference_id" value={r.id} />
      ))}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="erp-field">
          <label htmlFor="lv-start">시작일</label>
          <input id="lv-start" type="date" name="start_date" defaultValue={today} className="erp-input w-full" required />
        </div>
        <div className="erp-field">
          <label htmlFor="lv-end">종료일</label>
          <input id="lv-end" type="date" name="end_date" defaultValue={today} className="erp-input w-full" required />
        </div>
        <div className="erp-field">
          <label htmlFor="lv-days">사용 일수</label>
          <input id="lv-days" type="number" name="days" step="0.5" min="0.5" defaultValue="1" className="erp-input w-full" required />
        </div>
        <div className="erp-field">
          <label htmlFor="lv-reason">사유 (선택)</label>
          <input id="lv-reason" type="text" name="reason" autoComplete="off" className="erp-input w-full" />
        </div>
      </div>

      {presets.length > 0 && (
        <div className="erp-field" style={{ maxWidth: 320 }}>
          <label htmlFor="lv-preset">저장된 결재선 불러오기</label>
          <select id="lv-preset" className="erp-input w-full" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">선택 안 함</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--erp-text)" }}>
          결재선 · 참조자 선택
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
        <button ref={submitRef} type="submit" disabled={pending || approvers.length === 0} className="erp-btn erp-btn-primary">
          {pending ? "신청 중..." : "F7 휴가 신청"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
