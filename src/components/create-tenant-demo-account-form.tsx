"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTenantDemoAccount } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";
import { PageGuide } from "@/components/erp/page-guide";
import { ROLE_OPTIONS } from "@/lib/user-roles";
import { ErpSelect } from "@/components/erp/erp-select";

// 이 회사(테넌트) 소속으로 데모(테스트) 계정을 만든다 — 플랫폼 운영자
// 전용. 예전엔 테넌트 관리자 스스로 settings/users 화면에서 체크박스로
// 만들 수 있었는데, 어떤 계정이 가짜 데이터만 보이는 데모 계정인지는 그
// 회사가 아니라 엘보닉스 운영자가 판단/발급할 일이라는 지적으로 이
// 화면으로 옮겼다.
export function CreateTenantDemoAccountForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState(createTenantDemoAccount, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("staff");

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  // role select는 네이티브 폼 필드가 아니라 React state라 위 reset()으로는
  // 안 지워진다 — "prop(state)이 바뀌면 state 조정"은 렌더 중 비교로
  // 처리한다(이펙트에서 setState를 또 부르면 리렌더가 한 번 더 생긴다).
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) setRole("staff");
  }

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
        <ErpSelect
          id="ctd-role"
          name="role"
          value={role}
          onChange={setRole}
          options={ROLE_OPTIONS.map(([value, label]) => ({ value, label }))}
        />
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
