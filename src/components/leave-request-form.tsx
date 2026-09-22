"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";
import { OrgChartApproverPicker, type PickedPerson } from "@/components/org-chart-approver-picker";
import type { OrgDepartmentNode } from "@/lib/org-chart";
import type { ApprovalLinePresetOption } from "@/components/approval-document-form";
import { LEAVE_UNIT_DAYS, LEAVE_UNIT_LABEL, LEAVE_UNIT_OPTIONS, type LeaveUnit } from "@/lib/leave-unit";

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
  const [leaveUnit, setLeaveUnit] = useState<LeaveUnit>("full");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [days, setDays] = useState("1");

  // 반차/반반차는 하루만 신청할 수 있어서, 고르는 순간 종료일을 시작일에
  // 맞춰 잠그고 일수도 자동으로 채운다(0.5/0.25) — 종일만 여러 날짜에
  // 걸칠 수 있어 일수를 직접 입력받는다.
  function applyLeaveUnit(unit: LeaveUnit) {
    setLeaveUnit(unit);
    if (unit === "full") return;
    setEndDate(startDate);
    setDays(String(LEAVE_UNIT_DAYS[unit]));
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (leaveUnit !== "full") setEndDate(value);
  }

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

      <input type="hidden" name="leave_unit" value={leaveUnit} />

      <div className="erp-field" style={{ maxWidth: 480 }}>
        <label htmlFor="lv-unit">휴가 단위</label>
        <select
          id="lv-unit"
          className="erp-input w-full"
          value={leaveUnit}
          onChange={(e) => applyLeaveUnit(e.target.value as LeaveUnit)}
        >
          {LEAVE_UNIT_OPTIONS.map((unit) => (
            <option key={unit} value={unit}>
              {LEAVE_UNIT_LABEL[unit]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="erp-field">
          <label htmlFor="lv-start">시작일</label>
          <input
            id="lv-start"
            type="date"
            name="start_date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="erp-input w-full"
            required
          />
        </div>
        <div className="erp-field">
          <label htmlFor="lv-end">종료일</label>
          <input
            id="lv-end"
            type="date"
            name="end_date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={leaveUnit !== "full"}
            className="erp-input w-full"
            required
          />
        </div>
        <div className="erp-field">
          <label htmlFor="lv-days">사용 일수</label>
          <input
            id="lv-days"
            type="number"
            name="days"
            step="0.25"
            min="0.25"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            disabled={leaveUnit !== "full"}
            className="erp-input w-full"
            required
          />
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
