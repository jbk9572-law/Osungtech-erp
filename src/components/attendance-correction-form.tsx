"use client";

import { useActionState, useRef, useState } from "react";
import { type FormState } from "@/components/form-message";
import { ModalFormSheet } from "@/components/erp/modal-form-sheet";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { OrgChartApproverPicker, type PickedPerson } from "@/components/org-chart-approver-picker";
import type { OrgDepartmentNode } from "@/lib/org-chart";
import type { ApprovalLinePresetOption } from "@/components/approval-document-form";
import { ErpSelect } from "@/components/erp/erp-select";

export function AttendanceCorrectionForm({
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
    <div onKeyDown={preventEnterSubmit}>
      <ModalFormSheet
        title="근태 정정 신청"
        tabLabel="근태 정정 신청"
        formAction={formAction}
        state={state}
        pending={pending}
        disabled={approvers.length === 0}
        submitRef={submitRef}
        submitLabel={pending ? "신청 중..." : "F7 정정 신청"}
      >
        {approvers.map((a) => (
          <input key={a.id} type="hidden" name="approver_id" value={a.id} />
        ))}
        {references.map((r) => (
          <input key={r.id} type="hidden" name="reference_id" value={r.id} />
        ))}

        <div className="erp-field erp-span-3">
          <label htmlFor="ac-date">정정할 날짜</label>
          <input id="ac-date" type="date" name="work_date" defaultValue={today} className="erp-input erp-u-w-full" required />
        </div>
        <div className="erp-field erp-span-3">
          <label htmlFor="ac-in">출근 시간 정정 (선택)</label>
          <input id="ac-in" type="time" name="clock_in_time" className="erp-input erp-u-w-full" />
        </div>
        <div className="erp-field erp-span-3">
          <label htmlFor="ac-out">퇴근 시간 정정 (선택)</label>
          <input id="ac-out" type="time" name="clock_out_time" className="erp-input erp-u-w-full" />
        </div>
        {presets.length > 0 && (
          <div className="erp-field erp-span-3">
            <label htmlFor="ac-preset">저장된 결재선 불러오기</label>
            <ErpSelect
              id="ac-preset"
              value={presetId}
              onChange={applyPreset}
              options={[{ value: "", label: "선택 안 함" }, ...presets.map((p) => ({ value: p.id, label: p.name }))]}
            />
          </div>
        )}
        <div className="erp-field erp-span-12">
          <label htmlFor="ac-reason">정정 사유</label>
          <input id="ac-reason" type="text" name="reason" autoComplete="off" className="erp-input erp-u-w-full" required />
        </div>

        <div className="erp-field erp-span-12">
          <label>결재선 · 참조자 선택</label>
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
