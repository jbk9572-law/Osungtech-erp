"use client";

import { useActionState } from "react";
import { updateUserAccount } from "@/app/(dashboard)/settings/users/actions";
import { FormMessage } from "@/components/form-message";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/user-roles";

export function EditUserForm({
  userId,
  username,
  fullName,
  role,
  isSelf,
}: {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateUserAccount, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3" style={{ maxWidth: 420 }}>
      <input type="hidden" name="userId" value={userId} />
      <div className="erp-field">
        <label>아이디</label>
        <input name="username" defaultValue={username} required className="erp-input" />
      </div>
      <div className="erp-field">
        <label>이름</label>
        <input name="fullName" defaultValue={fullName} required className="erp-input" />
      </div>
      <div className="erp-field">
        <label>새 비밀번호 (변경할 때만 입력)</label>
        <input name="newPassword" type="password" minLength={6} className="erp-input" placeholder="비워두면 유지" />
      </div>
      <div className="erp-field">
        <label>역할</label>
        {isSelf ? (
          <>
            <input type="hidden" name="role" value={role} />
            <span className="text-sm">{ROLE_LABELS[role] ?? role}</span>
            <p className="mt-1 text-xs" style={{ color: "var(--erp-text-muted)" }}>
              본인 계정의 역할은 변경할 수 없습니다.
            </p>
          </>
        ) : (
          <select name="role" defaultValue={role} className="erp-select">
            {ROLE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      <FormMessage state={state} />
      <button type="submit" className="erp-btn erp-btn-primary" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
