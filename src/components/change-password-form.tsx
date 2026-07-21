"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "@/app/(dashboard)/settings/password/actions";
import { FormMessage } from "@/components/form-message";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex max-w-sm flex-col gap-3">
      <div className="erp-field">
        <label>현재 비밀번호</label>
        <input name="currentPassword" type="password" required className="erp-input" />
      </div>
      <div className="erp-field">
        <label>새 비밀번호</label>
        <input name="newPassword" type="password" required minLength={6} className="erp-input" />
      </div>
      <div className="erp-field">
        <label>새 비밀번호 확인</label>
        <input name="confirmPassword" type="password" required minLength={6} className="erp-input" />
      </div>
      <FormMessage state={state} />
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
        {pending ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}
