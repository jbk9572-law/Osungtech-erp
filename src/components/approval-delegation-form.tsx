"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { KeyboardHintBar } from "@/components/erp/keyboard-hint-bar";
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
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-2" style={{ maxWidth: 640 }}>
      {isAdmin ? (
        <div className="erp-field">
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
        <div className="erp-field">
          <label>위임자</label>
          <input aria-label="위임자(본인)" className="erp-input w-full" value="본인" disabled readOnly />
        </div>
      )}
      <div className="erp-field">
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
      <div className="erp-field">
        <label htmlFor="dg-start">시작일</label>
        <input id="dg-start" type="date" name="start_date" className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label htmlFor="dg-end">종료일</label>
        <input id="dg-end" type="date" name="end_date" className="erp-input w-full" required />
      </div>
      <div className="erp-field md:col-span-2">
        <label htmlFor="dg-reason">사유 (선택)</label>
        <input id="dg-reason" type="text" name="reason" autoComplete="off" className="erp-input w-full" placeholder="예: 출장, 휴가" />
      </div>
      <div className="flex items-center gap-2 md:col-span-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? "저장 중..." : "F7 위임 등록"}
        </button>
        <FormMessage state={state} />
      </div>
      <KeyboardHintBar items={[{ key: "F7", label: "저장" }]} />
    </form>
  );
}
