"use client";

import { useActionState } from "react";
import { updateTenantAddons, attachTenantAddon, detachTenantAddon } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";
import { addonKindLabel, addonKindUnit } from "@/lib/addon-kind";
import { formatNumber } from "@/lib/format-number";

type AddonCatalogItem = {
  id: string;
  key: string;
  name: string;
  kind: string;
  capacity: number;
  monthly_price: number;
};

type AddonSubscription = {
  addOnProductId: string;
  quantity: number;
  key: string;
  name: string;
  kind: string;
  capacity: number;
  monthlyPrice: number;
};

// 기획서(2026-10-27)의 "확장 애드온" 항목 — DB/파일 저장소 쿼터(이미
// 있는 TenantQuotaPanel)와 같은 선상에서, 외주처 연동 수/월간 이메일
// 발송 건수/팩스 발송 건수/자사 도메인 메일을 플랫폼 운영자가 수동
// 조정한다(결제 연동 전 단계라 updateTenantAddons가 tenants 컬럼에
// 최종 숫자를 그대로 저장 — actions.ts 주석 참고).
//
// 2026-10-28 기획서 "동적 애드온" 3번 항목 — 위 수동 조정과는 별도로,
// platform-admin/addons의 add_on_products 카탈로그에서 상품을 "골라서
// 부착"하는 섹션을 아래에 더했다. 부착/해제하면 attachTenantAddon/
// detachTenantAddon이 해당 kind의 tenants 쿼터 컬럼을 capacity×quantity
// 만큼 증감한다(actions.ts 참고) — 결제(PG) 연동 없이 바로 동작하는
// 내부 기능이다.
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
  addonCatalog,
  addonSubscriptions,
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
  addonCatalog: AddonCatalogItem[];
  addonSubscriptions: AddonSubscription[];
}) {
  const [state, formAction, pending] = useActionState(updateTenantAddons, undefined);

  return (
    <div style={{ maxWidth: 420 }}>
      <PageGuide>
        Standard 요금제 기본값은 외주처 1개사 / 월 이메일·팩스·계산서 각 100건입니다(매월 1일
        자동 리셋). 알림톡(카카오)·문자는 아직 실제 발송 기능이 없어 쿼터만 미리 마련해뒀습니다
        (기본 0건). 아래 숫자를 직접 조정하거나, 카탈로그에서 애드온을 부착해 늘릴 수 있습니다
        (결제 연동 전까지는 둘 다 수동 적용).
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

      <div
        style={{
          marginTop: "var(--erp-space-5)",
          paddingTop: "var(--erp-space-4)",
          borderTop: "1px solid var(--erp-divider)",
        }}
      >
        <p className="mb-2 text-xs font-bold" style={{ color: "var(--erp-text-muted)" }}>
          부착된 애드온
        </p>
        {addonSubscriptions.length === 0 ? (
          <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
            부착된 애드온이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-2" style={{ marginBottom: "var(--erp-space-3)" }}>
            {addonSubscriptions.map((s) => (
              <AddonSubscriptionRow key={s.addOnProductId} tenantId={tenantId} subscription={s} />
            ))}
          </div>
        )}

        <p className="mb-2 text-xs font-bold" style={{ color: "var(--erp-text-muted)" }}>
          카탈로그에서 부착
        </p>
        <AttachAddonForm tenantId={tenantId} catalog={addonCatalog} />
      </div>
    </div>
  );
}

// 이미 부착된 애드온 한 줄 — 수량 수정(델타만큼 쿼터 재조정)과 해제
// (쿼터에서 전량 차감)가 서로 다른 액션이라 각자 useActionState를
// 따로 갖는다(둘 다 동시에 pending일 일은 없다).
function AddonSubscriptionRow({ tenantId, subscription }: { tenantId: string; subscription: AddonSubscription }) {
  const [attachState, attachAction, attachPending] = useActionState(attachTenantAddon, undefined);
  const [detachState, detachAction, detachPending] = useActionState(detachTenantAddon, undefined);
  const unit = addonKindUnit(subscription.kind);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        border: "1px solid var(--erp-border)",
        padding: "8px 10px",
      }}
    >
      <div style={{ flex: "1 1 160px", minWidth: 0 }}>
        <div style={{ fontSize: "var(--erp-font-sm)", fontWeight: 600, color: "var(--erp-text)" }}>{subscription.name}</div>
        <div style={{ fontSize: "var(--erp-font-xs)", color: "var(--erp-text-muted)" }}>
          {addonKindLabel(subscription.kind)} · {formatNumber(subscription.capacity)}
          {unit} × {subscription.quantity}개 = {formatNumber(subscription.capacity * subscription.quantity)}
          {unit} · 월 {formatNumber(subscription.monthlyPrice * subscription.quantity)}원
        </div>
      </div>
      <form action={attachAction} style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="addOnProductId" value={subscription.addOnProductId} />
        <input
          type="number"
          name="quantity"
          min={1}
          defaultValue={subscription.quantity}
          className="erp-input"
          style={{ width: 60 }}
          aria-label={`${subscription.name} 수량`}
        />
        <button type="submit" disabled={attachPending} className="erp-btn" style={{ minWidth: 0 }}>
          {attachPending ? "저장 중..." : "수정"}
        </button>
      </form>
      <form action={detachAction}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="addOnProductId" value={subscription.addOnProductId} />
        <button type="submit" disabled={detachPending} className="erp-btn" style={{ minWidth: 0 }}>
          {detachPending ? "해제 중..." : "해제"}
        </button>
      </form>
      <FormMessage state={attachState ?? detachState} />
    </div>
  );
}

// 카탈로그(add_on_products)에서 상품을 골라 수량과 함께 부착한다 — 이미
// 부착된 상품을 다시 골라도 attachTenantAddon이 수량 차이만큼만 쿼터를
// 재조정하므로(actions.ts 참고) 수량 변경 용도로 또 써도 안전하다.
function AttachAddonForm({ tenantId, catalog }: { tenantId: string; catalog: AddonCatalogItem[] }) {
  const [state, formAction, pending] = useActionState(attachTenantAddon, undefined);

  if (catalog.length === 0) {
    return <PageGuide className="mb-0">등록된 애드온이 없습니다. 플랫폼 관리 &gt; 애드온 메뉴에서 먼저 등록해주세요.</PageGuide>;
  }

  return (
    <form action={formAction} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 8 }}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="erp-field">
        <label htmlFor="attach-product">애드온</label>
        <select id="attach-product" name="addOnProductId" required className="erp-select" style={{ width: 220 }}>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({formatNumber(c.capacity)}
              {addonKindUnit(c.kind)}, 월 {formatNumber(c.monthly_price)}원)
            </option>
          ))}
        </select>
      </div>
      <div className="erp-field">
        <label htmlFor="attach-qty">수량</label>
        <input id="attach-qty" type="number" name="quantity" min={1} defaultValue={1} className="erp-input" style={{ width: 70 }} />
      </div>
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ minWidth: 0 }}>
        {pending ? "부착 중..." : "부착"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
