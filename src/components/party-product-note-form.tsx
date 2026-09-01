"use client";

import { useActionState } from "react";
import type { FormState } from "@/components/form-message";

type NoteAction = (prevState: FormState, formData: FormData) => Promise<FormState>;

// 거래처(공급처)+상품 조합 전용 특이사항 입력칸. 판매단가/매입단가 표의
// 한 줄에 그대로 박혀서, 값을 고치고 저장을 누르면 그 행만 갱신된다 —
// customers/actions.ts의 updateCustomerProductPriceNotes와
// suppliers/actions.ts의 updateSupplierProductPriceNotes를 그대로
// action으로 받아 재사용한다(둘 다 id+notes(+customer_id/supplier_id)
// 시그니처가 동일).
export function PartyProductNoteForm({
  action,
  id,
  partyIdFieldName,
  partyId,
  initialNotes,
}: {
  action: NoteAction;
  id: string;
  partyIdFieldName: "customer_id" | "supplier_id";
  partyId: string;
  initialNotes: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name={partyIdFieldName} value={partyId} />
      <input
        name="notes"
        defaultValue={initialNotes ?? ""}
        placeholder="이 조합 전용 특이사항 (선택)"
        className="erp-input"
        style={{ height: 26, fontSize: 11.5, minWidth: 200 }}
      />
      <button type="submit" disabled={pending} className="erp-btn" style={{ minWidth: 0, height: 26, padding: "0 8px" }}>
        저장
      </button>
      {state?.error && (
        <span style={{ color: "var(--erp-danger)", fontSize: 11 }}>{state.error}</span>
      )}
    </form>
  );
}
