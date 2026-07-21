"use client";

import { useTransition } from "react";
import { updateUserRole } from "@/app/(dashboard)/settings/users/actions";

const ROLE_LABELS: Record<string, string> = {
  admin: "관리자",
  manager: "매니저",
  staff: "일반",
};

export function UserRoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      className="erp-select"
      style={{ height: 26, fontSize: 12.5 }}
      defaultValue={role}
      disabled={disabled || pending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("userId", userId);
        formData.set("role", e.target.value);
        startTransition(() => {
          updateUserRole(formData);
        });
      }}
    >
      {Object.entries(ROLE_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
