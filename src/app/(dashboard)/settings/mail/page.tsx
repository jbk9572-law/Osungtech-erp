import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { MailAccountForm } from "@/components/mail-account-form";

export default async function MailSettingsPage() {
  const supabase = await createClient();
  const user = await getUser();

  const { data: account } = user
    ? await supabase
        .from("mail_accounts")
        .select(
          "email_address, display_name, imap_host, imap_port, smtp_host, smtp_port, username, last_synced_at, last_sync_error"
        )
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="환경설정 > 메일 계정 연동" />

      <PageGuide>
        다음 스마트워크(회사 도메인 메일) 계정을 연결하면 ERP 안의 메일함에서
        그대로 받고 보낼 수 있습니다. 로그인 비밀번호가 아니라 다음에서 발급받은
        <b> 앱 비밀번호</b>를 입력해야 합니다(다음 설정 &gt; 보안 &gt; 앱 비밀번호에서
        발급). 여기서는 로그인 계정 정보를 등록만 하고, 실제 메일은 계속 다음
        서버에 그대로 남아있습니다.
      </PageGuide>

      <FormSection tabLabel="메일 계정">
        <MailAccountForm account={account} />
      </FormSection>
    </div>
  );
}
