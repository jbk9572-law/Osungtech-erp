"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

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

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-2" style={{ maxWidth: 640 }}>
      {isAdmin ? (
        <div className="erp-field">
          <label htmlFor="dg-delegator">위임자 (자리를 비우는 사람)</label>
          <select id="dg-delegator" name="delegator_id" className="erp-input w-full" required defaultValue="">
            <option value="" disabled>
              선택
            </option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || "구성원"}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="erp-field">
          <label>위임자</label>
          <input className="erp-input w-full" value="본인" disabled readOnly />
        </div>
      )}
      <div className="erp-field">
        <label htmlFor="dg-delegate">대리 결재자</label>
        <select id="dg-delegate" name="delegate_id" className="erp-input w-full" required defaultValue="">
          <option value="" disabled>
            선택
          </option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name || "구성원"}
            </option>
          ))}
        </select>
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
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? "저장 중..." : "위임 등록"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
