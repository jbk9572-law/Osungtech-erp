"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCompanyTenant } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";

export function CreateCompanyForm() {
  const [state, formAction, pending] = useActionState(createCompanyTenant, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="erp-field">
        <label htmlFor="cc-company-name">회사명</label>
        <input
          id="cc-company-name"
          name="companyName"
          autoComplete="off"
          required
          className="erp-input"
          placeholder="예: 엘보닉스"
        />
      </div>
      <div className="erp-field">
        <label htmlFor="cc-slug">슬러그(영문)</label>
        <input
          id="cc-slug"
          name="slug"
          autoComplete="off"
          required
          className="erp-input"
          placeholder="예: elvonix"
          title="로그인 이메일과 나중에 서브도메인/경로에 쓰이는 영문 값입니다"
        />
      </div>
      <div className="erp-field">
        <label htmlFor="cc-username">관리자 아이디</label>
        <input
          id="cc-username"
          name="username"
          autoComplete="off"
          required
          className="erp-input"
          placeholder="예: admin"
        />
      </div>
      <div className="erp-field">
        <label htmlFor="cc-fullname">관리자 이름</label>
        <input
          id="cc-fullname"
          name="fullName"
          autoComplete="off"
          required
          className="erp-input"
          placeholder="예: 홍길동"
        />
      </div>
      <div className="erp-field">
        <label htmlFor="cc-password">초기 비밀번호</label>
        <input id="cc-password" name="password" type="password" required minLength={6} className="erp-input" />
      </div>
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
        {pending ? "생성 중..." : "회사 추가"}
      </button>
      <div style={{ flexBasis: "100%" }}>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
