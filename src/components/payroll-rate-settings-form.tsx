"use client";

import { useActionState, useRef } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { useKeyShortcut } from "@/lib/use-key-shortcut";

export type PayrollRates = {
  year: number;
  minWageHourly: number;
  nationalPensionRate: number;
  healthInsuranceRate: number;
  longTermCareRate: number;
  employmentInsuranceRate: number;
  lastConfirmedAt: string | null;
  sourceNote: string | null;
};

export function PayrollRateSettingsForm({
  action,
  initial,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  initial: PayrollRates;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submitRef = useRef<HTMLButtonElement>(null);
  useKeyShortcut("F7", submitRef);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <input type="hidden" name="year" value={initial.year} />
      <div className="erp-field">
        <label htmlFor="pr-minwage">최저시급 (원)</label>
        <input id="pr-minwage" type="number" name="min_wage_hourly" step="1" min="0" defaultValue={initial.minWageHourly} className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label htmlFor="pr-pension">국민연금 요율(근로자, 소수)</label>
        <input id="pr-pension" type="number" name="national_pension_rate" step="0.0001" min="0" defaultValue={initial.nationalPensionRate} className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label htmlFor="pr-health">건강보험 요율(근로자, 소수)</label>
        <input id="pr-health" type="number" name="health_insurance_rate" step="0.00001" min="0" defaultValue={initial.healthInsuranceRate} className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label htmlFor="pr-ltc">장기요양보험 요율(건강보험료 대비, 소수)</label>
        <input id="pr-ltc" type="number" name="long_term_care_rate" step="0.0001" min="0" defaultValue={initial.longTermCareRate} className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label htmlFor="pr-employment">고용보험 요율(근로자, 소수)</label>
        <input id="pr-employment" type="number" name="employment_insurance_rate" step="0.0001" min="0" defaultValue={initial.employmentInsuranceRate} className="erp-input w-full" required />
      </div>
      <div className="erp-field">
        <label htmlFor="pr-confirmed">최종 확인일</label>
        <input id="pr-confirmed" type="date" name="last_confirmed_at" defaultValue={initial.lastConfirmedAt ?? ""} className="erp-input w-full" />
      </div>
      <div className="erp-field md:col-span-3">
        <label htmlFor="pr-source">근거(선택, 예: 고용노동부 고시 2026-01)</label>
        <input id="pr-source" type="text" name="source_note" autoComplete="off" defaultValue={initial.sourceNote ?? ""} className="erp-input w-full" />
      </div>
      <div className="md:col-span-3 flex items-center gap-2">
        <button ref={submitRef} type="submit" disabled={pending} className="erp-btn erp-btn-primary">
          {pending ? "저장 중..." : "F7 저장"}
        </button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
