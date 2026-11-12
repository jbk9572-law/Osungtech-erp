"use client";

import { useActionState, useState } from "react";
import { applyTenantIndustryPreset } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { ErpSelect } from "@/components/erp/erp-select";
import { INDUSTRY_PRESETS } from "@/lib/erp-menu";

type TenantOption = { id: string; name: string; industry: string | null };

// TenantThemeForm과 완전히 같은 모양 — 업체 선택과 업종 선택을 한 폼에
// 두되, 업체를 바꾸면 그 회사의 지금 값으로 셀렉트를 맞춰 보여주기만
// 하고(자동 제출 없음) "적용" 버튼을 눌러야 실제로 저장된다. 적용은
// 그 회사의 disabled_features에 시작값을 한 번 세팅해주는 것뿐이라,
// 적용 후에도 그 회사 관리자는 환경설정 > 기능 관리에서 개별 항목을
// 그대로 자유롭게 다시 켜고 끌 수 있다.
export function TenantIndustryForm({ tenants }: { tenants: TenantOption[] }) {
  const [state, action, pending] = useActionState(applyTenantIndustryPreset, undefined);
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [industry, setIndustry] = useState(tenants[0]?.industry ?? INDUSTRY_PRESETS[0]?.key ?? "");

  function handleTenantChange(nextId: string) {
    setTenantId(nextId);
    setIndustry(tenants.find((t) => t.id === nextId)?.industry ?? INDUSTRY_PRESETS[0]?.key ?? "");
  }

  if (!tenants.length) {
    return <p className="erp-grid-empty">등록된 회사가 없습니다.</p>;
  }

  const selectedPreset = INDUSTRY_PRESETS.find((p) => p.key === industry);

  return (
    <div className="erp-field" style={{ maxWidth: 520 }}>
      <label htmlFor="tenant-industry-company">회사(테넌트)</label>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <ErpSelect
          id="tenant-industry-company"
          name="tenantId"
          value={tenantId}
          onChange={handleTenantChange}
          options={tenants.map((t) => ({ value: t.id, label: t.name }))}
        />
        <ErpSelect
          id="tenant-industry-select"
          name="industry"
          value={industry}
          onChange={setIndustry}
          ariaLabel="업종"
          options={INDUSTRY_PRESETS.map((p) => ({ value: p.key, label: p.label }))}
        />
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ minWidth: 0 }}>
          {pending ? "적용 중..." : "적용"}
        </button>
      </form>
      {selectedPreset && (
        <p className="mt-1 text-xs erp-u-muted">
          {selectedPreset.description}
        </p>
      )}
      <FormMessage state={state} />
    </div>
  );
}
