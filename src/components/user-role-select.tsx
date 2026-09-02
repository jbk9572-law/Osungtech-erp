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
  const [prevRole, setPrevRole] = useState(role);
  const [value, setValue] = useState(role);
  const [pending, startTransition] = useTransition();

  // 서버에서 새 role이 내려오면(revalidatePath) 그대로 따라간다 — 아래
  // 실패 시 되돌리기와 짝을 이뤄, 화면 값이 실제 DB 값과 항상 같게 한다.
  // (렌더 중 조건부 setState — React가 권장하는 "prop 변경 시 상태 동기화"
  // 방식으로, useEffect보다 한 프레임 먼저 반영돼 깜빡임이 없다.)
  if (role !== prevRole) {
    setPrevRole(role);
    setValue(role);
  }

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
        const previous = value;
        setValue(nextRole);
        const formData = new FormData();
        formData.set("userId", userId);
        formData.set("role", nextRole);
        startTransition(async () => {
          const result = await updateUserRole(formData);
          // 실패하면(RLS, 네트워크 오류 등) 셀렉트가 실제로 반영 안 된
          // 값을 계속 보여주지 않도록 되돌린다 — 이전엔 결과를 확인하지
          // 않아서 실패해도 바뀐 값이 그대로 남아있었다.
          if (result?.error) {
            setValue(previous);
          }
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
