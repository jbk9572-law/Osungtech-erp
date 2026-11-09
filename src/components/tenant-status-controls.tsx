"use client";

import { useActionState, useRef, useState } from "react";
import {
  toggleTenantActive,
  updateTenantPlan,
  updateTenantPlanKey,
  updateTenantPlanPeriod,
  applyPlanDefaultsToTenant,
  setTenantSandbox,
} from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { isPlanExpired } from "@/lib/tenant-plan";
import { PageGuide } from "@/components/erp/page-guide";
import { ErpSelect } from "@/components/erp/erp-select";

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
  planKey,
  plans,
  planStartedAt,
  planExpiresAt,
  isSandbox,
}: {
  tenantId: string;
  disabled: boolean;
  plan: string;
  planKey: string | null;
  plans: { plan_key: string; name: string }[];
  planStartedAt: string | null;
  planExpiresAt: string | null;
  isSandbox: boolean;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(toggleTenantActive, undefined);
  const [planState, planAction, planPending] = useActionState(updateTenantPlan, undefined);
  const [planKeyState, planKeyAction, planKeyPending] = useActionState(updateTenantPlanKey, undefined);
  const [periodState, periodAction, periodPending] = useActionState(updateTenantPlanPeriod, undefined);
  const [applyState, applyAction, applyPending] = useActionState(applyPlanDefaultsToTenant, undefined);
  const [sandboxState, sandboxAction, sandboxPending] = useActionState(setTenantSandbox, undefined);

  const isExpired = isPlanExpired(planExpiresAt);
  const [planValue, setPlanValue] = useState(plan);
  const planFormRef = useRef<HTMLFormElement>(null);
  const [planKeyValue, setPlanKeyValue] = useState(planKey ?? "");
  const planKeyFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-3" style={{ maxWidth: 420 }}>
      <div className="erp-field">
        <label htmlFor="ts-plan">요금제 상태</label>
        <form ref={planFormRef} action={planAction} className="flex items-center gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <ErpSelect
            id="ts-plan"
            name="plan"
            value={planValue}
            onChange={(v) => {
              setPlanValue(v);
              planFormRef.current?.requestSubmit();
            }}
            options={Object.entries(PLAN_LABELS).map(([value, label]) => ({ value, label }))}
          />
          {planPending && <span className="erp-spinner" aria-hidden />}
        </form>
        <FormMessage state={planState} />
      </div>

      <div className="erp-field">
        <label htmlFor="ts-plan-key">요금제 상품(구독)</label>
        <form ref={planKeyFormRef} action={planKeyAction} className="flex items-center gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <ErpSelect
            id="ts-plan-key"
            name="planKey"
            value={planKeyValue}
            onChange={(v) => {
              setPlanKeyValue(v);
              planKeyFormRef.current?.requestSubmit();
            }}
            options={[{ value: "", label: "미지정" }, ...plans.map((p) => ({ value: p.plan_key, label: p.name }))]}
          />
          {planKeyPending && <span className="erp-spinner" aria-hidden />}
        </form>
        <FormMessage state={planKeyState} />
        {/* "요금제 설명에 숫자를 적어놔도 실제로 세팅하는 방법이 없다"는
            지적 — 요금제 관리 화면에서 입력한 기본값(DB/파일/외주처/
            이메일·팩스)을 이 고객사에 한 번에 복사한다. 자동으로는 안
            하고(위 select onChange로 요금제만 바뀌어도 매번 조용히
            덮어쓰면 수동으로 얹어준 여유 용량이 날아갈 수 있어서)
            명시적으로 눌러야만 적용된다. */}
        <form action={applyAction} className="mt-1">
          <input type="hidden" name="tenantId" value={tenantId} />
          <button type="submit" disabled={applyPending || !planKey} className="erp-btn" style={{ minWidth: 0 }}>
            {applyPending ? "적용 중..." : "이 요금제 기본값 적용"}
          </button>
        </form>
        <FormMessage state={applyState} />
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

      <div className="erp-field">
        <label>테스트 샌드박스</label>
        <form action={sandboxAction} className="flex items-center gap-2">
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="isSandbox" value={isSandbox ? "false" : "true"} />
          <button type="submit" disabled={sandboxPending} className="erp-btn">
            {sandboxPending ? "처리 중..." : isSandbox ? "샌드박스 지정 해제" : "샌드박스로 지정"}
          </button>
          <span className={`erp-badge ${isSandbox ? "erp-badge-info" : "erp-badge-muted"}`}>
            {isSandbox ? "샌드박스" : "일반"}
          </span>
        </form>
        <PageGuide className="mt-1 mb-0">
          샌드박스로 지정하면 그 테넌트에 로그인한 관리자가 환경설정 &gt; 샌드박스 도구에서 데이터를 원클릭
          초기화/더미 생성할 수 있습니다.
        </PageGuide>
        <FormMessage state={sandboxState} />
      </div>
    </div>
  );
}
