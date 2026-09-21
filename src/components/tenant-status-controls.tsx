"use client";

import { useActionState } from "react";
import { toggleTenantActive, updateTenantPlan, updateTenantPlanPeriod } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { isPlanExpired } from "@/lib/tenant-plan";

const PLAN_LABELS: Record<string, string> = {
  trial: "체험",
  active: "정상 이용",
  suspended: "이용 중지",
};

// date input(YYYY-MM-DD)에 넣을 값으로 자른다 — DB에는 타임존이 붙은
// timestamptz로 저장돼 있다.
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function TenantStatusControls({
  tenantId,
  disabled,
  plan,
  planStartedAt,
  planExpiresAt,
}: {
  tenantId: string;
  disabled: boolean;
  plan: string;
  planStartedAt: string | null;
  planExpiresAt: string | null;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(toggleTenantActive, undefined);
  const [planState, planAction, planPending] = useActionState(updateTenantPlan, undefined);
  const [periodState, periodAction, periodPending] = useActionState(updateTenantPlanPeriod, undefined);

  const isExpired = isPlanExpired(planExpiresAt);

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
        <label>이용기간</label>
        <form action={periodAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input
            type="date"
            name="planStartedAt"
            defaultValue={toDateInputValue(planStartedAt)}
            className="erp-input"
            style={{ width: 140 }}
            aria-label="이용 시작일"
          />
          <span>~</span>
          <input
            type="date"
            name="planExpiresAt"
            defaultValue={toDateInputValue(planExpiresAt)}
            className="erp-input"
            style={{ width: 140 }}
            aria-label="이용 만료일"
          />
          <button type="submit" disabled={periodPending} className="erp-btn" style={{ minWidth: 0 }}>
            {periodPending ? "저장 중..." : "저장"}
          </button>
          {planExpiresAt && (
            <span className={`erp-badge ${isExpired ? "erp-badge-danger" : "erp-badge-info"}`}>
              {isExpired ? "만료됨" : `${toDateInputValue(planExpiresAt)}까지`}
            </span>
          )}
        </form>
        <FormMessage state={periodState} />
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
