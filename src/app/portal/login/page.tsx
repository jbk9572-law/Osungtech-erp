"use client";

import { useActionState } from "react";
import { portalLogin } from "./actions";
import { PageGuide } from "@/components/erp/page-guide";

export default function PortalLoginPage() {
  const [state, formAction, pending] = useActionState(portalLogin, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f5] px-4">
      <div className="w-full max-w-[380px] rounded-sm border border-[#e2e5eb] bg-white p-6 shadow-sm">
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--erp-primary)", marginBottom: 4 }}>
          거래처 포털
        </div>
        <p style={{ fontSize: 12, color: "var(--erp-text-muted)", marginBottom: 20 }}>
          발주 및 주문 진행 상태 조회
        </p>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="erp-field">
            <label htmlFor="portal-email">이메일</label>
            <input id="portal-email" name="email" type="email" autoComplete="username" required className="erp-input" style={{ width: "100%" }} />
          </div>
          <div className="erp-field">
            <label htmlFor="portal-password">비밀번호</label>
            <input id="portal-password" name="password" type="password" autoComplete="current-password" required className="erp-input" style={{ width: "100%" }} />
          </div>
          {state?.error && (
            <p className="rounded-sm bg-[var(--erp-danger-bg)] px-3 py-2 text-xs font-medium text-[var(--erp-danger)]">
              {state.error}
            </p>
          )}
          <button type="submit" className="erp-btn erp-btn-primary w-full" disabled={pending}>
            {pending ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <PageGuide className="mt-4 mb-0">계정 발급은 거래 중인 회사 담당자에게 문의해주세요.</PageGuide>
      </div>
    </div>
  );
}
