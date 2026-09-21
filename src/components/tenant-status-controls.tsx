"use client";

import { useActionState } from "react";
import { toggleTenantActive, updateTenantPlan } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";

const PLAN_LABELS: Record<string, string> = {
  trial: "체험",
  active: "정상 이용",
  suspended: "이용 중지",
};

export function TenantStatusControls({
  tenantId,
  disabled,
  plan,
}: {
  tenantId: string;
  disabled: boolean;
  plan: string;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(toggleTenantActive, undefined);
  const [planState, planAction, planPending] = useActionState(updateTenantPlan, undefined);

  return (
    <div className="flex flex-col gap-3" style={{ maxWidth: 420 }}>
      <div className="erp-field">
        <label htmlFor="ts-plan">요금제 상태</label>
        <form action={planAction} className="flex items-center gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <select
            id="ts-plan"
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
          {planPending && <span className="erp-spinner" aria-hidden />}
        </form>
        <FormMessage state={planState} />
      </div>

      <div className="erp-field">
        <label>로그인 허용 여부</label>
        <form action={toggleAction} className="flex items-center gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="disable" value={disabled ? "false" : "true"} />
          <button
            type="submit"
            disabled={togglePending}
            className={`erp-btn ${disabled ? "erp-btn-primary" : "erp-btn-danger"}`}
          >
            {togglePending ? "처리 중..." : disabled ? "다시 활성화" : "비활성화(로그인 차단)"}
          </button>
          <span className={`erp-badge ${disabled ? "erp-badge-danger" : "erp-badge-success"}`}>
            {disabled ? "비활성" : "활성"}
          </span>
        </form>
        <FormMessage state={toggleState} />
      </div>
    </div>
  );
}
