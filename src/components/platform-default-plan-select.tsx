"use client";

import { useActionState } from "react";
import { updatePlatformDefaultPlan } from "@/app/platform-admin/settings/actions";
import { FormMessage } from "@/components/form-message";

const PLAN_LABELS: Record<string, string> = {
  trial: "체험",
  active: "정상 이용",
  suspended: "이용 중지",
};

export function PlatformDefaultPlanSelect({ plan }: { plan: string }) {
  const [state, action, pending] = useActionState(updatePlatformDefaultPlan, undefined);

  return (
    <div className="erp-field" style={{ maxWidth: 280 }}>
      <label htmlFor="platform-default-plan">신규 테넌트 기본 요금제</label>
      <form action={action} className="flex items-center gap-2">
        <select
          id="platform-default-plan"
          name="plan"
          defaultValue={plan}
          className="erp-select"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {Object.entries(PLAN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {pending && <span className="erp-spinner" aria-hidden />}
      </form>
      <FormMessage state={state} />
    </div>
  );
}
