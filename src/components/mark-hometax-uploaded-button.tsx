"use client";

import { useActionState } from "react";
import { markHometaxUploaded } from "@/app/(dashboard)/sales/tax-invoices/export/actions";
import { FormMessage } from "@/components/form-message";

export function MarkHometaxUploadedButton({ taxInvoiceIds }: { taxInvoiceIds: string[] }) {
  const [state, formAction, pending] = useActionState(markHometaxUploaded, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="tax_invoice_ids" value={JSON.stringify(taxInvoiceIds)} />
      <button type="submit" className="erp-btn" disabled={pending || taxInvoiceIds.length === 0}>
        {pending ? "표시 중..." : "✓ 홈택스 업로드 완료로 표시"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
