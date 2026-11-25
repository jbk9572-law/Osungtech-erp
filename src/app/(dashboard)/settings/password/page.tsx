import { ChangePasswordForm } from "@/components/change-password-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";

export default function ChangePasswordPage() {
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="환경설정 > 비밀번호 변경" />
      <ChangePasswordForm />
    </div>
  );
}
