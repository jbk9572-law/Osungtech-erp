"use client";

import type { FormState } from "@/components/form-message";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";

// 수금/지급 내역 한 줄 삭제 — 거래처/공급처/외주업체 공용(넘겨받은
// action이 실제 테이블을 결정).
export function PartyPaymentDeleteForm({
  action,
  id,
  partyIdField,
  partyId,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  id: string;
  partyIdField: "customer_id" | "supplier_id" | "subcontractor_id";
  partyId: string;
}) {
  return (
    <InlineConfirmDelete
      action={action}
      hiddenFields={{ id, [partyIdField]: partyId }}
      warningText="이 내역을 삭제하시겠습니까? 되돌릴 수 없습니다."
      triggerClassName="erp-btn erp-btn-danger erp-btn-xs"
    />
  );
}
