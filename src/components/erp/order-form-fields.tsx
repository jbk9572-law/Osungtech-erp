"use client";

import type { ReactNode, RefObject } from "react";
import { ErpSelect } from "@/components/erp/erp-select";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

// 매출/매입 등록 폼이 글자 그대로 복사해서 쓰던 폼 조각들 — 두 폼의 차이는 라벨
// 한 줄(저장 버튼 문구)과 날짜 변수 이름뿐이라 props로 받는다. 마크업·스타일은
// 원래 폼과 한 글자도 바꾸지 않았다.

/** "기본정보" 머리줄 오른쪽의 [저장 후 계속 등록] / [F7 저장] 버튼. label은 "F7 " 뒤에 붙는 문구. */
export function FormSaveButtons({
  isEdit,
  pending,
  submitRef,
  label,
}: {
  isEdit: boolean;
  pending: boolean;
  submitRef: RefObject<HTMLButtonElement | null>;
  label: string;
}) {
  return (
    <div className="erp-u-flex erp-u-gap-6">
      {/* 수정 화면(initial.id 있음)에는 "다음 건"이라는 개념이 없어서
          신규 등록일 때만 보여준다 — 하루에 여러 건을 연달아 입력할
          때마다 매번 목록/메뉴를 다시 타지 않아도 되게 한다. */}
      {!isEdit && (
        <button
          type="submit"
          name="continue_new"
          value="1"
          disabled={pending}
          className="erp-btn erp-u-minw-0 erp-u-m-4"
        >
          저장 후 계속 등록
        </button>
      )}
      <button
        ref={submitRef}
        type="submit"
        disabled={pending}
        className="erp-btn erp-btn-primary erp-u-minw-0 erp-u-m-4"
      >
        {pending ? (
          <>
            <span className="erp-spinner" aria-hidden /> 저장 중...
          </>
        ) : (
          `F7 ${label}`
        )}
      </button>
    </div>
  );
}

/** 폼 옵션 한 줄(.erp-form-options)에 놓는 체크 옵션 — 라벨 없는 칸으로 필드 격자에 끼워 넣지 않고, 같은 모양의 칩으로 한 줄에 나란히 둔다. */
export function FormCheckOption({
  checked,
  onChange,
  tone,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone?: "warn" | "info";
  children: ReactNode;
}) {
  return (
    <label className={`erp-check-option${checked ? ` is-checked${tone ? ` is-${tone}` : ""}` : ""}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** "N월 실적으로 이월" 체크 옵션. monthLabel은 nextMonthLabel(거래일자) 결과. */
export function CarryoverToggle({
  checked,
  onChange,
  monthLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  monthLabel: string;
}) {
  return (
    <FormCheckOption checked={checked} onChange={onChange} tone="warn">
      {monthLabel} 실적으로 이월
    </FormCheckOption>
  );
}

/** [항상 외상] 체크 옵션 — 체크를 풀면 결제방법 선택(PaymentMethodFields)이 나타난다. */
export function AlwaysCreditOption({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <FormCheckOption checked={checked} onChange={onChange}>
      항상 외상
    </FormCheckOption>
  );
}

/** 결제방법 선택 — "항상 외상"이 아닐 때만 나타난다(체크는 AlwaysCreditOption이 옵션 줄에서 맡는다). */
export function PaymentMethodFields({
  alwaysCredit,
  paymentMethod,
  onPaymentMethodChange,
}: {
  alwaysCredit: boolean;
  paymentMethod: string;
  onPaymentMethodChange: (v: string) => void;
}) {
  if (alwaysCredit) return null;
  return (
    <div className="erp-field erp-span-3">
      <label>결제방법</label>
      <ErpSelect
        ariaLabel="결제방법"
        value={paymentMethod}
        onChange={onPaymentMethodChange}
        placeholder="결제방법 선택"
        required
        options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
      />
    </div>
  );
}
