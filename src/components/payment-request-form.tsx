"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";
import { ReceiptPicker } from "@/components/receipt-picker";
import { PaymentRequestLineItems, type LineItemRow } from "@/components/payment-request-line-items";
import { PAYMENT_REQUEST_CARD_TYPES, type PaymentRequestCardType } from "@/lib/payment-request-title";
import { createPaymentRequest, updatePaymentRequest } from "@/app/(dashboard)/reports/payment-requests/actions";
import type { FormState } from "@/components/form-message";
import { preventEnterSubmit } from "@/lib/prevent-enter-submit";

type Initial = {
  id: string;
  department: string;
  periodFrom: string;
  periodTo: string;
  cardType: PaymentRequestCardType;
  items: LineItemRow[];
};

export function PaymentRequestForm({
  defaultDepartment,
  today,
  initial,
}: {
  defaultDepartment: string;
  today: string;
  initial?: Initial;
}) {
  const action = initial ? updatePaymentRequest : createPaymentRequest;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  const [department, setDepartment] = useState(initial?.department ?? defaultDepartment);
  const [periodFrom, setPeriodFrom] = useState(initial?.periodFrom ?? today);
  const [periodTo, setPeriodTo] = useState(initial?.periodTo ?? today);
  const [cardType, setCardType] = useState<PaymentRequestCardType>(initial?.cardType ?? "개인카드");

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-3 md:grid-cols-4"
      onKeyDown={preventEnterSubmit}
    >
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="department" value={department} />
      <input type="hidden" name="period_from" value={periodFrom} />
      <input type="hidden" name="period_to" value={periodTo} />

      <div className="erp-field">
        <label>부서명</label>
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="부서명"
          className="erp-input w-full"
        />
      </div>
      <div className="erp-field">
        <label>기간 시작</label>
        <input
          type="date"
          value={periodFrom}
          onChange={(e) => setPeriodFrom(e.target.value)}
          className="erp-input w-full"
        />
      </div>
      <div className="erp-field">
        <label>기간 종료</label>
        <input
          type="date"
          value={periodTo}
          onChange={(e) => setPeriodTo(e.target.value)}
          className="erp-input w-full"
        />
      </div>

      <div className="erp-field">
        <label>사용카드</label>
        <select
          name="card_type"
          value={cardType}
          onChange={(e) => setCardType(e.target.value as PaymentRequestCardType)}
          className="erp-input w-full"
        >
          {PAYMENT_REQUEST_CARD_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px]" style={{ color: "var(--erp-text-muted)" }}>
          한 문서에는 한 카드로 쓴 내역만 담아주세요 (신한/하나/개인 각각 따로 작성).
        </p>
      </div>

      <PaymentRequestLineItems initialRows={initial?.items} defaultDate={today} />

      {!initial && (
        <>
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs" style={{ color: "var(--erp-text-muted)" }}>
              영수증 사진
            </label>
            <ReceiptPicker />
          </div>
        </>
      )}

      <div className="md:col-span-4 flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 저장 중...
            </>
          ) : (
            "F7 저장"
          )}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
