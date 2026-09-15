"use client";

import { useActionState, useRef } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export function LeaveRequestForm({
  action,
  today,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
      <div className="md:col-span-4 flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? "신청 중..." : "F7 휴가 신청"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
