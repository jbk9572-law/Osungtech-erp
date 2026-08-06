"use client";

import { useActionState } from "react";
import type { FormState } from "@/components/form-message";

// 수금/지급 내역 한 줄 삭제 — 거래처/공급처 공용(넘겨받은 action이 실제
// 테이블을 결정).
export function PartyPaymentDeleteForm({
  action,
  id,
  partyIdField,
  partyId,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  partyIdField: "customer_id" | "supplier_id";
  partyId: string;
}) {
  const [, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("이 내역을 삭제하시겠습니까?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name={partyIdField} value={partyId} />
      <button
        type="submit"
        disabled={pending}
        className="erp-btn erp-btn-danger"
        style={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
      >
        삭제
      </button>
    </form>
  );
}
