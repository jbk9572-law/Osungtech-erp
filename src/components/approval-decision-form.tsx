"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

// 지금 결재 차례인 사람에게만 보이는 승인/반려 폼. 버튼 두 개가 같은
// name="decision"에 서로 다른 value를 담아 제출한다(sales-form의 "저장
// 후 계속 등록" 버튼과 같은 방식) — 어느 버튼을 눌렀는지로 결정을 구분.
export function ApprovalDecisionForm({
  action,
  stepId,
  documentId,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  stepId: string;
  documentId: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [comment, setComment] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-2" style={{ maxWidth: 480 }}>
      <input type="hidden" name="step_id" value={stepId} />
      <input type="hidden" name="document_id" value={documentId} />
      <div className="erp-field">
        <label htmlFor="ad-comment">결재 의견 (선택)</label>
        <input
          id="ad-comment"
          type="text"
          autoComplete="off"
          className="erp-input w-full"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <input type="hidden" name="comment" value={comment} />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending}
          className="erp-btn erp-btn-primary"
        >
          승인
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending}
          className="erp-btn erp-btn-danger"
        >
          반려
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
