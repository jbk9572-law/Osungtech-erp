"use client";

import { useActionState } from "react";
import { updateCustomerDocumentType } from "@/app/(dashboard)/customers/actions";
import { FormMessage } from "@/components/form-message";

export function CustomerDocumentTypeForm({
  customerId,
  documentType,
}: {
  customerId: string;
  documentType: "출고증" | "명세표";
}) {
  const [state, formAction, pending] = useActionState(updateCustomerDocumentType, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="customer_id" value={customerId} />
      <div>
        <label className="mb-1 block text-xs text-gray-500">발행 문서</label>
        <select
          name="document_type"
          defaultValue={documentType}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="명세표">명세표 (단가 포함)</option>
          <option value="출고증">출고증 (단가 없음)</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {pending ? "저장 중..." : "저장"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
