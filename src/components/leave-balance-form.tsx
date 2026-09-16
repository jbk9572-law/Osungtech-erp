"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

export function LeaveBalanceForm({
  action,
  userId,
  year,
  totalDays,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  userId: string;
  year: number;
  totalDays: number;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="year" value={year} />
      <input
        type="number"
        name="total_days"
        step="0.5"
        min="0"
        defaultValue={totalDays}
        className="erp-input"
        style={{ width: 90 }}
        aria-label="연차 총일수"
      />
      <button type="submit" disabled={pending} className="erp-btn" style={{ minWidth: 0, height: 28, padding: "0 10px" }}>
        {pending ? "저장 중..." : "저장"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
