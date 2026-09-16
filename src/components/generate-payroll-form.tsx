"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

export function GeneratePayrollForm({
  action,
  currentMonth,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  currentMonth: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2" style={{ marginBottom: 16 }}>
      <div className="erp-field">
        <label htmlFor="pg-month">급여월</label>
        <input id="pg-month" type="month" name="pay_month" defaultValue={currentMonth} className="erp-input" required />
      </div>
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ height: 30 }}>
        {pending ? "생성 중..." : "급여명세 생성(초안)"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
