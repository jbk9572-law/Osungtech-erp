"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

export function ConfirmPayslipButton({
  id,
  action,
}: {
  id: string;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="inline-flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="erp-btn erp-btn-primary erp-btn-xs"
        style={{ minWidth: 0, padding: "1px 8px", fontSize: 11 }}
      >
        {pending ? "처리 중..." : "확정"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
