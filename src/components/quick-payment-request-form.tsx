"use client";

import { useActionState, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { quickAddPaymentRequestItem } from "@/app/(dashboard)/reports/payment-requests/actions";
import { PAYMENT_REQUEST_CARD_TYPES, type PaymentRequestCardType } from "@/lib/payment-request-title";
import { ReceiptPicker } from "@/components/receipt-picker";
import { FieldHint } from "@/components/field-hint";

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
  const [highlighted, setHighlighted] = useState(false);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setFormKey((k) => k + 1);
      setHighlighted(false);
    }
  }

  return (
    <form action={formAction} key={formKey} className="grid grid-cols-1 gap-3 md:grid-cols-6">
      <div className="erp-field">
        <label htmlFor="qpr-used-at">일자</label>
        <input id="qpr-used-at" type="date" name="used_at" defaultValue={today} className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label htmlFor="qpr-department">부서명</label>
        <input
          id="qpr-department"
          name="department"
          autoComplete="off"
          defaultValue={defaultDepartment}
          className="erp-input w-full"
          required
        />
      </div>
      <div className="erp-field">
        <label htmlFor="qpr-card-type">
          카드
          <FieldHint text="같은 부서·카드·달에 등록한 내역끼리 자동으로 한 지급결의 문서로 묶입니다. 개인카드는 작성자별로 따로 묶입니다." />
        </label>
        <select id="qpr-card-type" name="card_type" defaultValue={PAYMENT_REQUEST_CARD_TYPES[0]} className="erp-input w-full">
          {PAYMENT_REQUEST_CARD_TYPES.map((type: PaymentRequestCardType) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="erp-field">
        <label htmlFor="qpr-vendor">사용처</label>
        <input id="qpr-vendor" name="vendor" autoComplete="off" className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label htmlFor="qpr-purpose">용도</label>
        <input
          id="qpr-purpose"
          name="purpose"
          autoComplete="off"
          placeholder="주유, 식대 등"
          className="erp-input w-full"
        />
      </div>
      <div className="erp-field">
        <label htmlFor="qpr-amount">금액</label>
        <input id="qpr-amount" type="number" name="amount" step="1" min="1" placeholder="-" className="erp-input w-full" required />
      </div>
      <div className="erp-field md:col-span-4">
        <label htmlFor="qpr-remark">비고 (선택)</label>
        <input id="qpr-remark" name="remark" autoComplete="off" className="erp-input w-full" />
      </div>
      <div className="erp-field">
        <label htmlFor="qpr-highlighted">강조 표시</label>
        <label
          style={{ display: "flex", alignItems: "center", gap: 6, height: 30, fontSize: 12.5, cursor: "pointer" }}
        >
          <input
            id="qpr-highlighted"
            type="checkbox"
            name="is_highlighted"
            checked={highlighted}
            onChange={(e) => setHighlighted(e.target.checked)}
            title="인쇄 시 이 줄을 강조(음영) 표시합니다"
          />
          인쇄 시 강조
        </label>
      </div>
      <div className="md:col-span-6">
        <label className="mb-1 block text-xs" style={{ color: "var(--erp-text-muted)" }}>
          영수증 사진 (선택)
        </label>
        <ReceiptPicker clearOn={state} />
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
