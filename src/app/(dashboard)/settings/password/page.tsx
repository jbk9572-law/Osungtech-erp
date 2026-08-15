import Link from "next/link";
import { ChangePasswordForm } from "@/components/change-password-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default function ChangePasswordPage() {
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">환경설정 &gt; 비밀번호 변경</h1>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>
      <p className="mb-4 text-xs text-[var(--erp-text-muted)]">본인 계정의 비밀번호를 변경합니다.</p>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">비밀번호 변경</span>
        </div>
        <div className="erp-detail-body">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
