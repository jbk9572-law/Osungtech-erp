"use client";

import { useActionState, useRef } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

export function LeaveBalanceForm({
  action,
  userId,
  year,
  totalDays,
  suggestedDays,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  userId: string;
  year: number;
  totalDays: number;
  // 입사일 기준 법정 연차 자동계산값(leave-accrual.ts) — 있으면 입력칸
  // 옆에 "적용" 버튼으로 보여준다. 클릭해도 바로 저장되지 않고 입력칸에
  // 값만 채워 넣는다 — 회사마다 있을 수 있는 특약(경력 가산 등)을 자동
  // 계산값이 조용히 덮어쓰지 않게, 마지막 확인·저장은 항상 사람이 한다.
  suggestedDays?: number | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="year" value={year} />
      <input
        ref={inputRef}
        type="number"
        name="total_days"
        step="0.5"
        min="0"
        defaultValue={totalDays}
        className="erp-input"
        style={{ width: 90 }}
        aria-label="연차 총일수"
      />
      {suggestedDays != null && (
        <button
          type="button"
          onClick={() => {
            if (inputRef.current) inputRef.current.value = String(suggestedDays);
          }}
          className="erp-btn"
          style={{ minWidth: 0, height: 28, padding: "0 8px", fontSize: 11 }}
          title="입사일 기준 법정 연차 자동계산값을 입력칸에 채웁니다"
        >
          자동계산 {suggestedDays}일 적용
        </button>
      )}
      <button type="submit" disabled={pending} className="erp-btn" style={{ minWidth: 0, height: 28, padding: "0 10px" }}>
        {pending ? "저장 중..." : "저장"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
