"use client";

import { useActionState, useRef, useState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

const METHODS = ["현금", "계좌이체", "카드", "어음"];

// 거래처(출고처)의 수금, 공급처의 지급 등록 폼 — 필드 구성이 완전히 같아서
// 하나로 공유한다. 실제로 다른 테이블(customer_payments/supplier_payments)에
// 쓰는 건 넘겨받은 action이 결정한다.
export function PartyPaymentForm({
  action,
  partyIdField,
  partyId,
  today,
  label,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  partyIdField: "customer_id" | "supplier_id";
  partyId: string;
  today: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  // 저장에 성공하면 입력값을 비운다. useActionState의 state는 성공할 때마다
  // (같은 메시지라도) 새 객체로 오므로, 그 객체 자체가 바뀌었는지로 판단해서
  // formKey를 올려 폼을 리마운트한다 — 메시지 문자열만 비교하면 "연속으로
  // 같은 메시지" 케이스를 놓친다.
  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) setFormKey((k) => k + 1);
  }

  return (
    <form action={formAction} key={formKey} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <input type="hidden" name={partyIdField} value={partyId} />
      <div className="erp-field">
        <label>일자</label>
        <input type="date" name="paid_at" defaultValue={today} className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label>금액</label>
        <input type="number" name="amount" step="1" min="1" placeholder="-" className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label>방법</label>
        <select name="method" className="erp-input w-full" defaultValue="">
          <option value="">-</option>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="erp-field">
        <label>메모</label>
        <input type="text" name="memo" className="erp-input w-full" />
      </div>
      <div className="md:col-span-4 flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? (
            <>
              <span className="erp-spinner" aria-hidden /> 저장 중...
            </>
          ) : (
            `F7 ${label} 등록`
          )}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
