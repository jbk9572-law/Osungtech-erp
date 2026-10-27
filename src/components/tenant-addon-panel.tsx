"use client";

import { useActionState } from "react";
import { updateTenantAddons } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";

// 기획서(2026-10-27)의 "확장 애드온" 항목 — DB/파일 저장소 쿼터(이미
// 있는 TenantQuotaPanel)와 같은 선상에서, 외주처 연동 수/월간 이메일
// 발송 건수/팩스 발송 건수/자사 도메인 메일을 플랫폼 운영자가 수동
// 조정한다(결제 연동 전 단계라 updateTenantAddons가 tenants 컬럼에
// 최종 숫자를 그대로 저장 — actions.ts 주석 참고).
export function TenantAddonPanel({
  tenantId,
  vendorLimit,
  vendorCount,
  monthlyEmailQuota,
  emailSentThisMonth,
  monthlyFaxQuota,
  customDomainMail,
}: {
  tenantId: string;
  vendorLimit: number;
  vendorCount: number;
  monthlyEmailQuota: number;
  emailSentThisMonth: number;
  monthlyFaxQuota: number;
  customDomainMail: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateTenantAddons, undefined);

  return (
    <div style={{ maxWidth: 420 }}>
      <PageGuide>
        Standard 요금제 기본값은 외주처 1개사 / 월 이메일·팩스 각 100건입니다(매월 1일 자동
        리셋). 추가 애드온을 요청받으면 여기서 직접 늘려주세요(추후 결제 연동 전까지는 수동
        관리).
      </PageGuide>

      <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
        현재: 외주처 {vendorCount}개사 사용 중 · 이번 달 이메일 발송 {emailSentThisMonth}건
      </p>

      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="tenantId" value={tenantId} />
        <div className="erp-field">
          <label htmlFor="ta-vendor">외주처(협력사) 연동 수</label>
          <input
            id="ta-vendor"
            type="number"
            name="vendorLimit"
            min={0}
            defaultValue={vendorLimit}
            className="erp-input"
            style={{ width: 140 }}
            required
          />
        </div>
        <div className="erp-field">
          <label htmlFor="ta-email">월 이메일 발송 쿼터(건)</label>
          <input
            id="ta-email"
            type="number"
            name="monthlyEmailQuota"
            min={0}
            defaultValue={monthlyEmailQuota}
            className="erp-input"
            style={{ width: 140 }}
            required
          />
        </div>
        <div className="erp-field">
          <label htmlFor="ta-fax">월 팩스 발송 쿼터(건)</label>
          <input
            id="ta-fax"
            type="number"
            name="monthlyFaxQuota"
            min={0}
            defaultValue={monthlyFaxQuota}
            className="erp-input"
            style={{ width: 140 }}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-xs" style={{ color: "var(--erp-text-muted)" }}>
          <input type="checkbox" name="customDomainMail" value="1" defaultChecked={customDomainMail} />
          자사 도메인 메일 애드온(프리미엄) 사용
        </label>
        <div>
          <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ minWidth: 0 }}>
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
        <FormMessage state={state} />
      </form>
    </div>
  );
}
