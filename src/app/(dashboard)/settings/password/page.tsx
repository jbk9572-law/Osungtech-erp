import { ChangePasswordForm } from "@/components/change-password-form";

export default function ChangePasswordPage() {
  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-[#1c1c1c]">환경설정 &gt; 비밀번호 변경</h1>
      <p className="mb-4 text-xs text-[#6b7280]">본인 계정의 비밀번호를 변경합니다.</p>

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
