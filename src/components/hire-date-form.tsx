"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

// 연차 자동계산(leave-accrual.ts)의 입력값인 입사일을 그 자리에서 바로
// 고칠 수 있게 한다 — 별도 직원정보 화면으로 안 가도 연차관리 화면에서
// 입사일을 넣자마자 법정 연차 자동계산값이 다시 보이게 하기 위함.
export function HireDateForm({
  action,
  userId,
  hireDate,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  userId: string;
  hireDate: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="user_id" value={userId} />
      <input
        type="date"
        name="hire_date"
        defaultValue={hireDate ?? ""}
        className="erp-input"
        style={{ width: 130 }}
        aria-label="입사일"
      />
      <button type="submit" disabled={pending} className="erp-btn" style={{ minWidth: 0, height: 28, padding: "0 8px" }}>
        {pending ? "저장 중..." : "저장"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
