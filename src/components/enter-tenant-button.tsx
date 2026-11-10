"use client";

import { useActionState } from "react";
import { startTenantImpersonation } from "@/app/platform-admin/actions";

// 고객사 상세(tenant-detail-panel.tsx)에서 바로 그 회사로 들어가는 빠른
// 진입점 — 리본의 "회사 전환" 검색 모달(ribbon.tsx)과 같은 액션을
// 재사용하되, 회사를 고를 필요 없이 이 상세가 보여주는 회사로 고정해서
// 보낸다("문의받은 그 회사를 바로 열어본다"는 흔한 흐름에 맞춤).
export function EnterTenantButton({ tenantId }: { tenantId: string }) {
  const [, action, pending] = useActionState(startTenantImpersonation, undefined);

  return (
    <form action={action}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <button type="submit" disabled={pending} className="erp-btn">
        {pending ? "들어가는 중..." : "이 회사로 들어가기"}
      </button>
    </form>
  );
}
