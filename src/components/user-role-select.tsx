"use client";

import { useState, useTransition } from "react";
import { updateUserRole } from "@/app/(dashboard)/settings/users/actions";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/user-roles";

// 권한 변경은 삭제만큼 되돌리기 까다로운 동작이라(관리자 권한을 실수로
// 뺏기면 본인이 다시 못 돌려놓을 수 있다), 클릭 한 번으로 바로 적용되지
// 않게 확인을 한 번 거친다. 브라우저 기본 confirm() 대신 다른 화면들과
// 톤을 맞춘 인라인 확인 방식을 쓴다 — 셀렉트를 바꾸면 적용 전에 "확정/취소"
// 칩이 바로 옆에 뜬다.
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
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 서버에서 새 role이 내려오면(revalidatePath) 그대로 따라간다 — 아래
  // 실패 시 되돌리기와 짝을 이뤄, 화면 값이 실제 DB 값과 항상 같게 한다.
  // (렌더 중 조건부 setState — React가 권장하는 "prop 변경 시 상태 동기화"
  // 방식으로, useEffect보다 한 프레임 먼저 반영돼 깜빡임이 없다.)
  if (role !== prevRole) {
    setPrevRole(role);
    setValue(role);
    setPendingRole(null);
  }

  function commit(nextRole: string) {
    const previous = value;
    setValue(nextRole);
    setPendingRole(null);
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("role", nextRole);
    startTransition(async () => {
      const result = await updateUserRole(formData);
      // 실패하면(RLS, 네트워크 오류 등) 셀렉트가 실제로 반영 안 된 값을
      // 계속 보여주지 않도록 되돌린다.
      if (result?.error) {
        setValue(previous);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select
        className="erp-select"
        style={{ height: 26, fontSize: 12.5 }}
        value={pendingRole ?? value}
        disabled={disabled || pending}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setPendingRole(e.target.value)}
      >
        {ROLE_OPTIONS.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
      {pendingRole && pendingRole !== value && (
        <span
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-1 text-xs"
          style={{
            background: "var(--erp-danger-bg)",
            color: "var(--erp-danger)",
            border: "1px solid var(--erp-danger-border)",
          }}
        >
          {ROLE_LABELS[value] ?? value} → {ROLE_LABELS[pendingRole] ?? pendingRole}로 변경?
          <button
            type="button"
            className="erp-btn erp-btn-danger"
            style={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11.5 }}
            onClick={(e) => {
              e.stopPropagation();
              commit(pendingRole);
            }}
          >
            확정
          </button>
          <button
            type="button"
            className="erp-btn"
            style={{ minWidth: 0, height: 22, padding: "0 8px", fontSize: 11.5 }}
            onClick={(e) => {
              e.stopPropagation();
              setPendingRole(null);
            }}
          >
            취소
          </button>
        </span>
      )}
    </span>
  );
}
