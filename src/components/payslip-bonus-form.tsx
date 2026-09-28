"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

// 성과금/특별상여금은 기본급과 달리 매월 값이 다르므로(직원 급여정보처럼
// 한 번 설정해두고 끝나는 값이 아니라) 급여명세 표의 각 행에서 바로 그
// 달 값을 입력한다. 확정된 명세는 이 폼 자체를 안 그린다(부모가 status로
// 분기).
export function PayslipBonusForm({
  id,
  action,
  bonusPerformance,
  bonusSpecial,
}: {
  id: string;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  bonusPerformance: number;
  bonusSpecial: number;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <input
        type="number"
        name="bonus_performance"
        step="1000"
        min="0"
        defaultValue={bonusPerformance}
        className="erp-input"
        style={{ width: 100 }}
        aria-label="성과금"
        title="성과금"
      />
      <input
        type="number"
        name="bonus_special"
        step="1000"
        min="0"
        defaultValue={bonusSpecial}
        className="erp-input"
        style={{ width: 100 }}
        aria-label="특별상여금"
        title="특별상여금"
      />
      <button type="submit" disabled={pending} className="erp-btn" style={{ minWidth: 0, height: 28, padding: "0 10px" }}>
        {pending ? "저장 중..." : "반영"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
