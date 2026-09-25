"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

// 공문 상세 화면의 발송 처리/종결/취소 버튼 — 셋 다 문서 id 하나만
// 넘기고 상태만 바꾸는 동일한 모양이라 하나로 합쳤다(issue-document-button.tsx와
// 같은 패턴).
export function OfficialDocumentStatusButton({
  id,
  action,
  label,
  pendingLabel,
  tone = "default",
}: {
  id: string;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  pendingLabel: string;
  tone?: "default" | "primary" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className={`erp-btn${tone === "primary" ? " erp-btn-primary" : tone === "danger" ? " erp-btn-danger" : ""}`}
      >
        {pending ? pendingLabel : label}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
