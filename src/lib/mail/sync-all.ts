import { createAdminClient } from "@/lib/supabase/admin";
import { syncMailAccount, type MailAccountForSync } from "@/lib/mail/sync";
import { notifyForTenant } from "@/lib/notify";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export type SyncAllResult = { accountsChecked: number; accountsFailed: number; newTotal: number };

type MailAccountForCron = MailAccountForSync & { tenant_id: string };

// 세션이 없는 곳(메일 폴링 크론 — src/app/api/cron/mail-sync/route.ts)에서
// 테넌트 전체의 모든 메일 계정을 순회하며 동기화한다. 관리자 클라이언트를
// 쓰므로 RLS를 거치지 않고 mail_accounts 전체를 볼 수 있다 — tenant_id는
// 각 계정 행 자체에 있어 계정마다 맞는 테넌트로 정확히 쓸 수 있다.
// mail_accounts에는 is_demo 컬럼이 없으므로(메일함은 user_id RLS 하나로만
// 이미 완전히 격리되는 개인 데이터라 필요 없었다 — migration 127 참고),
// 알림을 보낼 때는 그 계정 소유자의 profiles.is_demo를 대신 조회해서 쓴다.
export async function syncAllMailAccounts(): Promise<SyncAllResult> {
  const admin = createAdminClient();

  const accounts = await fetchAllRows<MailAccountForCron>((from, to) =>
    admin
      .from("mail_accounts")
      .select("id, tenant_id, user_id, imap_host, imap_port, username, encrypted_app_password, last_synced_uid")
      .eq("is_active", true)
      .range(from, to),
  );

  if (!accounts.length) return { accountsChecked: 0, accountsFailed: 0, newTotal: 0 };

  // mail_accounts.user_id는 auth.users를 참조해서(public.profiles가 아니라)
  // PostgREST 자동 조인이 안 걸린다 — 계정 소유자들의 is_demo만 따로 조회해
  // JS에서 합친다.
  const { data: owners } = await admin
    .from("profiles")
    .select("id, is_demo")
    .in(
      "id",
      accounts.map((a) => a.user_id),
    );
  const isDemoByUserId = new Map((owners ?? []).map((o) => [o.id, o.is_demo]));

  let accountsFailed = 0;
  let newTotal = 0;

  for (const account of accounts) {
    try {
      const result = await syncMailAccount(admin, account);
      newTotal += result.newCount;
      if (result.newCount > 0) {
        await notifyForTenant({
          tenantId: account.tenant_id,
          isDemo: isDemoByUserId.get(account.user_id) ?? false,
          userIds: [account.user_id],
          type: "mail",
          title: "새 메일 도착",
          body: `${result.newCount}통의 새 메일이 도착했습니다.`,
          url: "/mail",
        });
      }
    } catch (err) {
      // 계정 하나가 실패해도(비밀번호 만료, 서버 점검 등) 나머지 계정은
      // 계속 처리한다 — syncMailAccount가 이미 그 계정의 last_sync_error에
      // 기록해두므로 여기서는 로그만 남기고 다음 계정으로 넘어간다.
      accountsFailed += 1;
      console.error(`메일 동기화 실패 (account ${account.id}):`, err);
    }
  }

  return { accountsChecked: accounts.length, accountsFailed, newTotal };
}
