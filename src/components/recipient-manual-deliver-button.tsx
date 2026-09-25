"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";

export function RecipientManualDeliverButton({
  recipientId,
  officialDocumentId,
  action,
}: {
  recipientId: string;
  officialDocumentId: string;
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="recipient_id" value={recipientId} />
      <input type="hidden" name="official_document_id" value={officialDocumentId} />
      <button type="submit" disabled={pending} className="erp-btn" style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}>
        {pending ? "처리 중..." : "직접 발송 처리"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
