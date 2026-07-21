"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUserAccount } from "@/app/(dashboard)/settings/users/actions";
import { FormMessage } from "@/components/form-message";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAccount, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="erp-field">
        <label>아이디</label>
        <input name="username" required className="erp-input" placeholder="예: hong" />
      </div>
      <div className="erp-field">
        <label>이름</label>
        <input name="fullName" required className="erp-input" placeholder="예: 홍길동" />
      </div>
      <div className="erp-field">
        <label>비밀번호</label>
        <input name="password" type="password" required minLength={6} className="erp-input" />
      </div>
      <div className="erp-field">
        <label>역할</label>
        <select name="role" defaultValue="staff" className="erp-select">
          <option value="staff">일반</option>
          <option value="manager">매니저</option>
          <option value="admin">관리자</option>
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
