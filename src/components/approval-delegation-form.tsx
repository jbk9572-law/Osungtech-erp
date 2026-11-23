"use client";

import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { ModalFormSheet } from "@/components/erp/modal-form-sheet";
import { ErpSelect } from "@/components/erp/erp-select";

export function ApprovalDelegationForm({
  action,
  isAdmin,
  profiles,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  isAdmin: boolean;
  profiles: { id: string; full_name: string | null }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [delegatorId, setDelegatorId] = useState("");
  const [delegateId, setDelegateId] = useState("");
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <ModalFormSheet title="새 위임 등록" tabLabel="새 위임 등록" formAction={formAction} state={state} pending={pending} submitRef={submitRef} submitLabel="F7 저장">
      {isAdmin ? (
        <div className="erp-field erp-span-6">
          <label htmlFor="dg-delegator">위임자 (자리를 비우는 사람)</label>
          <ErpSelect
            id="dg-delegator"
            name="delegator_id"
            required
            placeholder="선택"
            value={delegatorId}
            onChange={setDelegatorId}
            options={profiles.map((p) => ({ value: p.id, label: p.full_name || "구성원" }))}
          />
        </div>
      ) : (
        <div className="erp-field erp-span-6">
          <label htmlFor="dg-delegator-self">위임자</label>
          <input id="dg-delegator-self" aria-label="위임자(본인)" className="erp-input erp-u-w-full" value="본인" disabled readOnly />
        </div>
      )}
      <div className="erp-field erp-span-6">
        <label htmlFor="dg-delegate">대리 결재자</label>
        <ErpSelect
          id="dg-delegate"
          name="delegate_id"
          required
          placeholder="선택"
          value={delegateId}
          onChange={setDelegateId}
          options={profiles.map((p) => ({ value: p.id, label: p.full_name || "구성원" }))}
        />
      </div>
      <div className="erp-field erp-span-6">
        <label htmlFor="dg-start">시작일</label>
        <input id="dg-start" type="date" name="start_date" className="erp-input erp-u-w-full" required />
      </div>
      <div className="erp-field erp-span-6">
        <label htmlFor="dg-end">종료일</label>
        <input id="dg-end" type="date" name="end_date" className="erp-input erp-u-w-full" required />
      </div>
      <div className="erp-field erp-span-12">
        <label htmlFor="dg-reason">사유 (선택)</label>
        <input id="dg-reason" type="text" name="reason" autoComplete="off" className="erp-input erp-u-w-full" placeholder="예: 출장, 휴가" />
      </div>
    </ModalFormSheet>
  );
}
