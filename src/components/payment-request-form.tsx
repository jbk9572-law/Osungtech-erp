"use client";

import { useActionState, useRef } from "react";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { createPaymentRequest } from "@/app/(dashboard)/reports/payment-requests/actions";

export function PaymentRequestForm() {
  const [state, formAction, pending] = useActionState(createPaymentRequest, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <input name="title" placeholder="제목" required className="erp-input sm:col-span-3" />
      <input name="amount" type="number" step="1" placeholder="금액" className="erp-input" />
      <textarea
        name="content"
        placeholder="내용"
        rows={10}
        className="erp-input sm:col-span-3"
        style={{ resize: "vertical" }}
      />
      <div className="sm:col-span-3 flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? "저장 중..." : "F7 저장"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
