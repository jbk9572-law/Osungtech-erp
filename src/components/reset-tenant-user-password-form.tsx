"use client";

import { useActionState, useState } from "react";
import { resetTenantUserPassword } from "@/app/platform-admin/actions";
import { FormMessage } from "@/components/form-message";

export function ResetTenantUserPasswordForm({ tenantId, userId }: { tenantId: string; userId: string }) {
  const [state, formAction, pending] = useActionState(resetTenantUserPassword, undefined);
  const [open, setOpen] = useState(false);

  // 성공 시 패널을 닫는다 — InlineConfirmDelete와 동일한 state identity 비교
  // 패턴. 패널 자체가 open===false일 때 언마운트되므로 폼을 따로 reset()할
  // 필요가 없다(다음에 열리면 새 인스턴스로 다시 렌더링됨).
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state?.success) {
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="erp-btn" style={{ minWidth: 0 }}>
        비밀번호 재설정
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="userId" value={userId} />
      <input
        type="password"
        name="newPassword"
        minLength={6}
        required
        placeholder="새 비밀번호(6자 이상)"
        className="erp-input"
        style={{ width: 160 }}
        autoFocus
      />
      <button type="submit" disabled={pending} className="erp-btn erp-btn-primary" style={{ minWidth: 0 }}>
        {pending ? "저장 중..." : "확인"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="erp-btn" style={{ minWidth: 0 }}>
        취소
      </button>
      <FormMessage state={state} />
    </form>
  );
}
