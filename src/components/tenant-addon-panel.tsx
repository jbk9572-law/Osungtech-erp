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
//
// TODO(다음 단계 — 2026-10-28 기획서 "동적 애드온" 3번 항목, 외부 API
// 불필요한 순수 내부 작업): 지금은 관리자가 이 숫자들을 손으로 직접
// 타이핑하지만, platform-admin/addons에 이미 만들어둔 add_on_products
// 카탈로그에서 상품을 "골라서 부착"하는 방식으로 바꿀 것 —
// 1) tenant_addon_subscriptions(tenant_id, add_on_product_id, quantity)
//    테이블 신설(add_on_products를 FK로 참조),
// 2) 이 패널에 "카탈로그에서 추가" UI를 더해 부착/해제하면
//    tenants.monthly_*_quota를 base_plan 포함량 + Σ(부착된 애드온
//    capacity × quantity)로 재계산해 저장,
// 3) "매월 1일 자동 리셋"은 기존 tenant_monthly_usage처럼 (tenant_id,
//    year_month) 복합키로 달마다 새 행을 만드는 방식이면 배치 작업 없이
//    자연히 해결됨(migration 189와 같은 패턴).
// 실제 결제(PG) 연동은 이것과 별개로, 그 다음 단계에서나 필요하다.
export function TenantAddonPanel({
  tenantId,
  vendorLimit,
  vendorCount,
  monthlyEmailQuota,
  emailSentThisMonth,
  monthlyFaxQuota,
  faxSentThisMonth,
  monthlyInvoiceQuota,
  invoiceIssuedThisMonth,
  monthlyAlimtalkQuota,
  alimtalkSentThisMonth,
  customDomainMail,
}: {
  tenantId: string;
  vendorLimit: number;
  vendorCount: number;
  monthlyEmailQuota: number;
  emailSentThisMonth: number;
  monthlyFaxQuota: number;
  faxSentThisMonth: number;
  monthlyInvoiceQuota: number;
  invoiceIssuedThisMonth: number;
  monthlyAlimtalkQuota: number;
  alimtalkSentThisMonth: number;
  customDomainMail: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateTenantAddons, undefined);

  return (
    <div style={{ maxWidth: 420 }}>
      <PageGuide>
        Standard 요금제 기본값은 외주처 1개사 / 월 이메일·팩스·계산서 각 100건입니다(매월 1일
        자동 리셋). 알림톡(카카오)·문자는 아직 실제 발송 기능이 없어 쿼터만 미리 마련해뒀습니다
        (기본 0건). 추가 애드온을 요청받으면 여기서 직접 늘려주세요(추후 결제 연동 전까지는
        수동 관리).
      </PageGuide>

      <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
        이번 달 사용량 — 외주처 {vendorCount}개사 · 이메일 {emailSentThisMonth}건 · 팩스{" "}
        {faxSentThisMonth}건 · 계산서 {invoiceIssuedThisMonth}건 · 알림톡/문자{" "}
        {alimtalkSentThisMonth}건
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
        <div className="erp-field">
          <label htmlFor="ta-invoice">월 계산서 발행 쿼터(건)</label>
          <input
            id="ta-invoice"
            type="number"
            name="monthlyInvoiceQuota"
            min={0}
            defaultValue={monthlyInvoiceQuota}
            className="erp-input"
            style={{ width: 140 }}
            required
          />
        </div>
        <div className="erp-field">
          <label htmlFor="ta-alimtalk">월 알림톡/문자 발송 쿼터(건)</label>
          <input
            id="ta-alimtalk"
            type="number"
            name="monthlyAlimtalkQuota"
            min={0}
            defaultValue={monthlyAlimtalkQuota}
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
