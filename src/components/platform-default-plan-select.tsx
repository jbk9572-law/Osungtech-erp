"use client";

import { useActionState, useRef, useState } from "react";
import { updatePlatformDefaultPlan } from "@/app/platform-admin/settings/actions";
import { FormMessage } from "@/components/form-message";
import { ErpSelect } from "@/components/erp/erp-select";

const PLAN_LABELS: Record<string, string> = {
  trial: "체험",
  active: "정상 이용",
  suspended: "이용 중지",
};

export function PlatformDefaultPlanSelect({ plan }: { plan: string }) {
  const [state, action, pending] = useActionState(updatePlatformDefaultPlan, undefined);
  const [selectedPlan, setSelectedPlan] = useState(plan);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="erp-field" style={{ maxWidth: 280 }}>
      <label htmlFor="platform-default-plan">신규 테넌트 기본 요금제</label>
      <form ref={formRef} action={action} className="flex items-center gap-2">
        <ErpSelect
          id="platform-default-plan"
          name="plan"
          value={selectedPlan}
          onChange={(v) => {
            setSelectedPlan(v);
            formRef.current?.requestSubmit();
          }}
          options={Object.entries(PLAN_LABELS).map(([value, label]) => ({ value, label }))}
        />
        {pending && <span className="erp-spinner" aria-hidden />}
      </form>
      <FormMessage state={state} />
    </div>
  );
}
