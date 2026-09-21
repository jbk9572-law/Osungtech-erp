"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPlatformPlan } from "@/app/platform-admin/plans/actions";
import { FormMessage } from "@/components/form-message";

export function CreatePlatformPlanForm() {
  const [state, formAction, pending] = useActionState(createPlatformPlan, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="erp-field">
        <label htmlFor="pp-key">요금제 키(영문)</label>
        <input id="pp-key" name="plan_key" autoComplete="off" required className="erp-input" placeholder="예: basic" />
      </div>
      <div className="erp-field">
        <label htmlFor="pp-name">이름</label>
        <input id="pp-name" name="name" autoComplete="off" required className="erp-input" placeholder="예: 베이직" />
      </div>
      <div className="erp-field">
        <label htmlFor="pp-price">월 가격(원)</label>
        <input
          id="pp-price"
          name="monthly_price"
          type="number"
          min={0}
          step={1000}
          defaultValue={0}
          className="erp-input"
          style={{ width: 120 }}
        />
      </div>
      <div className="erp-field" style={{ flex: "1 1 200px" }}>
        <label htmlFor="pp-description">설명</label>
        <input id="pp-description" name="description" autoComplete="off" className="erp-input" />
      </div>
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary">
        {pending ? "등록 중..." : "등록"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
