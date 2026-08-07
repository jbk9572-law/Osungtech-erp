"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { quickAddPaymentRequestItem } from "@/app/(dashboard)/reports/payment-requests/actions";
import { PAYMENT_REQUEST_CARD_TYPES, type PaymentRequestCardType } from "@/lib/payment-request-title";

// 월말에 몰아 쓰지 않고 그날그날 한 줄씩 빠르게 기록하는 입력창. 문서를
// 고르지 않아도 서버 액션이 "부서+카드종류+이번 달" 문서를 찾거나 새로
// 만들어서 거기에 줄을 추가한다(quickAddPaymentRequestItem).
export function QuickPaymentRequestForm({
  defaultDepartment,
  today,
}: {
  defaultDepartment: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(quickAddPaymentRequestItem, undefined);

  // 저장 성공 시 입력값을 비운다 — PartyPaymentForm과 동일하게, state
  // 객체의 identity가 바뀌었는지로 판단해서 폼을 리마운트한다(같은 성공
  // 메시지가 연속으로 와도 놓치지 않기 위함).
  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) setFormKey((k) => k + 1);
  }

  return (
    <form action={formAction} key={formKey} className="grid grid-cols-1 gap-3 md:grid-cols-6">
      <div className="erp-field">
        <label>일자</label>
        <input type="date" name="used_at" defaultValue={today} className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label>부서명</label>
        <input name="department" defaultValue={defaultDepartment} className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label>카드</label>
        <select name="card_type" defaultValue={PAYMENT_REQUEST_CARD_TYPES[0]} className="erp-input w-full">
          {PAYMENT_REQUEST_CARD_TYPES.map((type: PaymentRequestCardType) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="erp-field">
        <label>사용처</label>
        <input name="vendor" className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label>용도</label>
        <input name="purpose" placeholder="주유, 식대 등" className="erp-input w-full" />
      </div>
      <div className="erp-field">
        <label>금액</label>
        <input type="number" name="amount" step="1" min="1" placeholder="0" className="erp-input w-full" required />
      </div>
      <div className="erp-field md:col-span-5">
        <label>비고 (선택)</label>
        <input name="remark" className="erp-input w-full" />
      </div>
      <div className="erp-field flex items-end">
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary w-full">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 저장 중...
            </>
          ) : (
            "오늘 지출 등록"
          )}
        </button>
      </div>
      <div className="md:col-span-6">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
