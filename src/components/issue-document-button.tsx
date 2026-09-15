"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

export function IssueDocumentButton({
  id,
  action,
}: {
  id: string;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? "처리 중..." : "발급완료로 표시"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
