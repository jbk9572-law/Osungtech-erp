"use client";

import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { useActionState, useEffect, useRef, useState } from "react";
import { createUserAccount } from "@/app/(dashboard)/settings/users/actions";
import { FormMessage } from "@/components/form-message";
import { ROLE_OPTIONS } from "@/lib/user-roles";
import { ErpSelect } from "@/components/erp/erp-select";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAccount, undefined);
  const formRef = useRef<HTMLFormElement>(null);
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

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="erp-field">
        <label htmlFor="cu-username">아이디</label>
        <input
          id="cu-username"
          name="username"
          autoComplete="off"
          required
          className="erp-input"
          placeholder="예: hong"
        />
      </div>
      <div className="erp-field">
        <label htmlFor="cu-fullname">이름</label>
        <input
          id="cu-fullname"
          name="fullName"
          autoComplete="off"
          required
          className="erp-input"
          placeholder="예: 홍길동"
        />
      </div>
      <div className="erp-field">
        <label htmlFor="cu-password">비밀번호</label>
        <input id="cu-password" name="password" type="password" required minLength={MIN_PASSWORD_LENGTH} className="erp-input" />
      </div>
      <div className="erp-field">
        <label htmlFor="cu-role">역할</label>
        <ErpSelect
          id="cu-role"
          name="role"
          value={role}
          onChange={setRole}
          options={ROLE_OPTIONS.map(([value, label]) => ({ value, label }))}
        />
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
