"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUserAccount } from "@/app/(dashboard)/settings/users/actions";
import { FormMessage } from "@/components/form-message";
import { ROLE_OPTIONS } from "@/lib/user-roles";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAccount, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="erp-field">
        <label htmlFor="cu-username">아이디</label>
        <input id="cu-username" name="username" required className="erp-input" placeholder="예: hong" />
      </div>
      <div className="erp-field">
        <label htmlFor="cu-fullname">이름</label>
        <input id="cu-fullname" name="fullName" required className="erp-input" placeholder="예: 홍길동" />
      </div>
      <div className="erp-field">
        <label htmlFor="cu-password">비밀번호</label>
        <input id="cu-password" name="password" type="password" required minLength={6} className="erp-input" />
      </div>
      <div className="erp-field">
        <label htmlFor="cu-role">역할</label>
        <select id="cu-role" name="role" defaultValue="staff" className="erp-select">
          {ROLE_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
        {pending ? "생성 중..." : "계정 생성"}
      </button>
      <div style={{ flexBasis: "100%" }}>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
