"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

export function EmployeePayForm({
  action,
  userId,
  monthlyBasePay,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  userId: string;
  monthlyBasePay: number;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <input
        type="number"
        name="monthly_base_pay"
        step="1000"
        min="0"
        defaultValue={monthlyBasePay}
        className="erp-input"
        style={{ width: 140 }}
        aria-label="월 기본급"
      />
      <button type="submit" disabled={pending} className="erp-btn" style={{ minWidth: 0, height: 28, padding: "0 10px" }}>
        {pending ? "저장 중..." : "저장"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
