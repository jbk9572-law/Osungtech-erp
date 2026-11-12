"use client";

import type { RefObject } from "react";
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
    <div style={{ display: "flex", gap: 6 }}>
      {/* 수정 화면(initial.id 있음)에는 "다음 건"이라는 개념이 없어서
          신규 등록일 때만 보여준다 — 하루에 여러 건을 연달아 입력할
          때마다 매번 목록/메뉴를 다시 타지 않아도 되게 한다. */}
      {!isEdit && (
        <button
          type="submit"
          name="continue_new"
          value="1"
          disabled={pending}
          className="erp-btn"
          style={{ minWidth: 0, margin: 4 }}
        >
          저장 후 계속 등록
        </button>
      )}
      <button
        ref={submitRef}
        type="submit"
        disabled={pending}
        className="erp-btn erp-btn-primary"
        style={{ minWidth: 0, margin: 4 }}
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

/** "N월 실적으로 이월" 체크박스. monthLabel은 nextMonthLabel(거래일자) 결과. */
export function CarryoverToggle({
  checked,
  onChange,
  monthLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  monthLabel: string;
}) {
  const isCarryover = checked;
  return (
    <div className="erp-field erp-span-3">
      <label aria-hidden="true">&nbsp;</label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 34,
          padding: "0 14px",
          borderRadius: "var(--erp-radius-lg, 0)",
          background: isCarryover ? "var(--erp-warning-bg)" : "transparent",
          border: `1px solid ${isCarryover ? "var(--erp-warning-border)" : "var(--erp-border)"}`,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        <input
          type="checkbox"
          checked={isCarryover}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          style={{
            fontWeight: 700,
            color: isCarryover ? "var(--erp-warning)" : "var(--erp-text-muted)",
          }}
        >
          {monthLabel} 실적으로 이월
        </span>
      </label>
    </div>
  );
}

/** 결제방법: [항상 외상] 체크 + (외상이 아닐 때) 결제수단 선택. */
export function PaymentMethodFields({
  alwaysCredit,
  onAlwaysCreditChange,
  paymentMethod,
  onPaymentMethodChange,
}: {
  alwaysCredit: boolean;
  onAlwaysCreditChange: (v: boolean) => void;
  paymentMethod: string;
  onPaymentMethodChange: (v: string) => void;
}) {
  const setAlwaysCredit = onAlwaysCreditChange;
  const setPaymentMethod = onPaymentMethodChange;
  return (
    <>
      <div className="erp-field erp-span-3">
        <label>결제방법</label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 30,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={alwaysCredit}
            onChange={(e) => setAlwaysCredit(e.target.checked)}
          />
          항상 외상
        </label>
      </div>
      {!alwaysCredit && (
        <div className="erp-field erp-span-3">
          <label aria-hidden="true">&nbsp;</label>
          <ErpSelect
            ariaLabel="결제방법"
            value={paymentMethod}
            onChange={setPaymentMethod}
            placeholder="결제방법 선택"
            required
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
          />
        </div>
      )}
    </>
  );
}
