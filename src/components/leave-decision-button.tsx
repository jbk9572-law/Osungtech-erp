"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

// 결재 대기 휴가 신청의 승인/반려 버튼 한 개. FormState를 리턴하는 서버
// 액션은 이 코드베이스 관례상 항상 useActionState를 거쳐서 쓴다 —
// <form action={fn}>에 직접 넘기면 폼 액션이 기대하는 단일 인자
// 시그니처와 안 맞아 타입 에러가 난다.
export function LeaveDecisionButton({
  id,
  decision,
  action,
}: {
  id: string;
  decision: "approved" | "rejected";
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="inline-flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision} />
      <button
        type="submit"
        disabled={pending}
        className={decision === "approved" ? "erp-btn erp-btn-primary" : "erp-btn erp-btn-danger"}
        style={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
      >
        {decision === "approved" ? "승인" : "반려"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
