"use client";

import { useActionState } from "react";
import { updateCompanyTenant } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";

export function EditCompanyForm({
  tenantId,
  name,
  slug,
}: {
  tenantId: string;
  name: string;
  slug: string;
}) {
  const [state, formAction, pending] = useActionState(updateCompanyTenant, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3" style={{ maxWidth: 420 }}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="erp-field">
        <label htmlFor="ec-name">회사명</label>
        <input id="ec-name" name="name" autoComplete="off" defaultValue={name} required className="erp-input" />
      </div>
      <div className="erp-field">
        <label htmlFor="ec-slug">슬러그(영문)</label>
        <input id="ec-slug" name="slug" autoComplete="off" defaultValue={slug} required className="erp-input" />
        <PageGuide className="mt-1">
          슬러그를 바꾸면 이 회사 모든 계정의 로그인 이메일(아이디@슬러그.elvonix.local)이 바뀌어, 기존 아이디로 로그인이 안 됩니다. 정말 필요할 때만 바꾸세요.
        </PageGuide>
      </div>
      <FormMessage state={state} />
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
