"use client";

import { useActionState } from "react";
import { deletePaymentRequestReceipt } from "@/app/(dashboard)/reports/payment-requests/actions";

// 영수증 썸네일 하나를 지우는 작은 폼. 페이지 전체를 감싸는 DeleteButton과
// 달리 목록 안 항목 하나만 지우고 나머지는 그대로 둬야 해서 별도로 둔다.
// 서버 액션의 revalidatePath로 목록이 다시 그려지므로 클라이언트에서
// 따로 상태를 들고 있지 않아도 된다.
export function ReceiptDeleteForm({ id, paymentRequestId }: { id: string; paymentRequestId: string }) {
  const [state, formAction, pending] = useActionState(deletePaymentRequestReceipt, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("이 영수증을 삭제하시겠습니까?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="payment_request_id" value={paymentRequestId} />
      <button
        type="submit"
        disabled={pending}
        className="erp-btn erp-btn-danger"
        style={{ padding: "1px 6px", fontSize: 11 }}
      >
        ×
      </button>
      {state?.error && (
        <p className="mt-1 text-[10px]" style={{ color: "var(--erp-danger)" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
