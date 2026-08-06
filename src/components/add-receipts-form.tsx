"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { ReceiptPicker } from "@/components/receipt-picker";
import { addPaymentRequestReceipts } from "@/app/(dashboard)/reports/payment-requests/actions";

export function AddReceiptsForm({ paymentRequestId }: { paymentRequestId: string }) {
  const [state, formAction, pending] = useActionState(addPaymentRequestReceipts, undefined);

  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="payment_request_id" value={paymentRequestId} />
      <ReceiptPicker />
      <div className="mt-2 flex items-center gap-2">
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 추가 중...
            </>
          ) : (
            "영수증 추가"
          )}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
