"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTenantDemoAccount } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";
import { ROLE_OPTIONS } from "@/lib/user-roles";

// 이 회사(테넌트) 소속으로 데모(테스트) 계정을 만든다 — 플랫폼 운영자
// 전용. 예전엔 테넌트 관리자 스스로 settings/users 화면에서 체크박스로
// 만들 수 있었는데, 어떤 계정이 가짜 데이터만 보이는 데모 계정인지는 그
// 회사가 아니라 엘보닉스 운영자가 판단/발급할 일이라는 지적으로 이
// 화면으로 옮겼다.
export function CreateTenantDemoAccountForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState(createTenantDemoAccount, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="erp-btn" style={{ minWidth: 0 }}>
        + 데모 계정 추가
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="erp-field">
        <label htmlFor="ctd-username">아이디</label>
        <input id="ctd-username" name="username" autoComplete="off" required className="erp-input" placeholder="예: demo" />
      </div>
      <div className="erp-field">
        <label htmlFor="ctd-fullname">이름</label>
        <input id="ctd-fullname" name="fullName" autoComplete="off" required className="erp-input" placeholder="예: 체험계정" />
      </div>
      <div className="erp-field">
        <label htmlFor="ctd-password">비밀번호</label>
        <input id="ctd-password" name="password" type="password" required minLength={6} className="erp-input" />
      </div>
      <div className="erp-field">
        <label htmlFor="ctd-role">역할</label>
        <select id="ctd-role" name="role" defaultValue="staff" className="erp-select">
          {ROLE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
        {pending ? "생성 중..." : "데모 계정 생성"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="erp-btn" style={{ minWidth: 0 }}>
        취소
      </button>
      <div style={{ flexBasis: "100%" }}>
        <PageGuide className="mb-0">
          이 계정으로 로그인하면 실제 거래처/매출/재고 등은 전혀 안 보이고, 이 계정이 직접 입력한 가짜 데이터만 보고 등록/수정할 수 있습니다.
        </PageGuide>
      </div>
      <div style={{ flexBasis: "100%" }}>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
