"use client";

import { useState, useTransition } from "react";
import { updateUserRole } from "@/app/(dashboard)/settings/users/actions";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/user-roles";

export function UserRoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(role);
  const [pending, startTransition] = useTransition();

  return (
    <select
      className="erp-select"
      style={{ height: 26, fontSize: 12.5 }}
      value={value}
      disabled={disabled || pending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const nextRole = e.target.value;
        // 권한 변경은 삭제만큼 되돌리기 까다로운 동작이라(관리자 권한을
        // 실수로 뺏기면 본인이 다시 못 돌려놓을 수 있다), 다른 곳의 삭제
        // 확인처럼 클릭 한 번으로 바로 적용되지 않게 확인을 한 번 거친다.
        const ok = window.confirm(
          `${ROLE_LABELS[nextRole] ?? nextRole} 권한으로 바꿀까요?`
        );
        if (!ok) return;
        setValue(nextRole);
        const formData = new FormData();
        formData.set("userId", userId);
        formData.set("role", nextRole);
        startTransition(() => {
          updateUserRole(formData);
        });
      }}
    >
      {ROLE_OPTIONS.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
