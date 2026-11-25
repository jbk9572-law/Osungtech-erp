"use client";

import { useActionState, useState } from "react";
import { setTenantInvoiceForms } from "@/app/platform-admin/invoice-form-actions";
import { FormMessage } from "@/components/form-message";
import { ErpSelect } from "@/components/erp/erp-select";
import { ALL_INVOICE_FORMS, INVOICE_FORM_LABEL, legacyInvoiceForms } from "@/lib/invoice-form";

type TenantOption = { id: string; name: string; theme: string; slug: string; allowedForms: string[] | null };

// 회사(테넌트)별 사용 가능한 인쇄 서식 지정 — TenantThemeForm과 같은 모양(회사 고르기 + 값 고르기 + [적용]).
// 업체를 바꾸면 그 회사의 지금 설정으로 체크 칸만 맞춰 보여주고, [적용]을 눌러야만 저장된다.
// 아직 지정한 적이 없는 회사는 지금 실제로 보이는 서식(기존 규칙)을 처음 체크값으로 보여준다 — 그대로 적용하면 지금 모습이 "못박힌다".
function currentOf(t: TenantOption | undefined): string[] {
  if (!t) return [];
  return t.allowedForms ?? legacyInvoiceForms({ theme: t.theme, slug: t.slug });
}

export function TenantInvoiceFormsForm({ tenants }: { tenants: TenantOption[] }) {
  const [state, action, pending] = useActionState(setTenantInvoiceForms, undefined);
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [forms, setForms] = useState<string[]>(currentOf(tenants[0]));
  const tenant = tenants.find((t) => t.id === tenantId);

  function handleTenantChange(nextId: string) {
    setTenantId(nextId);
    setForms(currentOf(tenants.find((t) => t.id === nextId)));
  }
  const toggle = (f: string) => setForms((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  if (!tenants.length) return <p className="erp-grid-empty">등록된 회사가 없습니다.</p>;

  return (
    <form action={action} className="erp-field erp-u-maxw-520">
      <label htmlFor="tenant-invoice-company">회사(테넌트)</label>
      <ErpSelect
        id="tenant-invoice-company"
        name="tenantId"
        value={tenantId}
        onChange={handleTenantChange}
        options={tenants.map((t) => ({ value: t.id, label: t.name }))}
      />
      <div role="group" aria-label="사용 가능한 인쇄 서식" className="erp-fb-checks">
        {ALL_INVOICE_FORMS.map((f) => (
          <label key={f} className="erp-fb-check-inline">
            <input type="checkbox" name="forms" value={f} checked={forms.includes(f)} onChange={() => toggle(f)} /> {INVOICE_FORM_LABEL[f]}
          </label>
        ))}
      </div>
      <p className="erp-u-muted erp-u-text-sm">
        {tenant?.allowedForms ? "지정된 서식만 그 회사 인쇄 화면에 나옵니다." : "아직 지정한 적이 없어 기존 규칙(테마·회사)을 따르는 중입니다 — 지금 보이는 서식이 체크돼 있습니다."}
      </p>
      <div className="erp-fb-checks">
        <button type="submit" disabled={pending} className="erp-btn erp-btn-primary erp-u-minw-0">
          {pending ? "적용 중..." : "적용"}
        </button>
        <button type="submit" name="reset" value="1" disabled={pending || !tenant?.allowedForms} className="erp-btn erp-u-minw-0">
          기존 규칙으로
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
