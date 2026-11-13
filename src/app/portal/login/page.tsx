"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { portalLogin } from "./actions";
import { PageGuide } from "@/components/erp/page-guide";

export default function PortalLoginPage() {
  return (
    <Suspense fallback={null}>
      <PortalLoginForm />
    </Suspense>
  );
}

function PortalLoginForm() {
  const [state, formAction, pending] = useActionState(portalLogin, undefined);
  const otherSessionNotice = useSearchParams().get("notice") === "other_session";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--erp-bg)] px-4">
      <div className="w-full max-w-[380px] rounded-sm border border-[var(--erp-border)] bg-white p-6 shadow-sm">
        <div className="erp-u-bold erp-u-text erp-u-mb-4" style={{ fontSize: 18 }}>
          거래처 포털
        </div>
        <p className="erp-u-muted erp-u-text-compact erp-u-mb-20">
          발주 및 주문 진행 상태 조회
        </p>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="erp-field">
            <label htmlFor="portal-email">이메일</label>
            <input id="portal-email" name="email" type="email" autoComplete="username" required className="erp-input erp-u-w-full" />
          </div>
          <div className="erp-field">
            <label htmlFor="portal-password">비밀번호</label>
            <input id="portal-password" name="password" type="password" autoComplete="current-password" required className="erp-input erp-u-w-full" />
          </div>
          {otherSessionNotice && (
            <p className="rounded-sm bg-[var(--erp-info-bg)] px-3 py-2 text-xs font-medium text-[var(--erp-info-text)]">
              다른 곳에서 로그인되어 자동으로 로그아웃되었습니다. 본인이 아니라면 비밀번호를 변경해주세요.
            </p>
          )}
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
