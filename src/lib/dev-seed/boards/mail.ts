import type { ActingSession, BoardSeedResult } from "../types";
import { MAIL_SUBJECTS, pick, randomCompanyName } from "../korean-data";

const MAIL_ACTOR_COUNT = 3;

// 실제 IMAP 계정 없이 메일함 화면을 테스트할 수 있게, is_active=false인
// "가짜" 메일 계정을 몇 명의 더미 직원에게 하나씩 붙여준다 —
// is_active=false라서 실제 동기화 크론(syncAllMailAccounts)이 이 계정은
// 건드리지 않는다(.eq("is_active", true) 필터). 이 더미 메일을 보려면
// 해당 더미 직원 계정으로 로그인해야 한다(메일함은 user_id 기준
// 개인함이라 다른 계정에서는 안 보임 — 로그인 안내에 명시).
export async function seedMail(actors: ActingSession[], count: number): Promise<BoardSeedResult> {
  const mailActors = actors.slice(0, MAIL_ACTOR_COUNT);
  let created = 0;
  let lastError: string | undefined;

  for (const actor of mailActors) {
    const { data: existingAccount, error: accountLookupError } = await actor.client
      .from("mail_accounts")
      .select("id")
      .eq("user_id", actor.employee.id)
      .maybeSingle();
    if (accountLookupError) {
      lastError = accountLookupError.message;
      continue;
    }

    let accountId = existingAccount?.id;
    if (!accountId) {
      const { data: created_, error: createError } = await actor.client
        .from("mail_accounts")
        .insert({
          user_id: actor.employee.id,
          email_address: actor.employee.email,
          display_name: `${actor.employee.fullName} (테스트)`,
          username: actor.employee.username,
          encrypted_app_password: "dev-seed-placeholder",
          is_active: false,
        })
        .select("id")
        .single();
      if (createError || !created_) {
        lastError = createError?.message ?? "더미 메일 계정 생성 실패";
        continue;
      }
      accountId = created_.id;
    }

    const { data: maxUidRow } = await actor.client
      .from("mail_messages")
      .select("uid")
      .eq("mail_account_id", accountId)
      .order("uid", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextUid = (maxUidRow?.uid ?? 0) + 1;

    const perActorCount = Math.ceil(count / mailActors.length);
    for (let i = 0; i < perActorCount; i++) {
      const company = randomCompanyName();
      const { error } = await actor.client.from("mail_messages").insert({
        mail_account_id: accountId,
        user_id: actor.employee.id,
        folder: "INBOX",
        uid: nextUid++,
        subject: `${pick(MAIL_SUBJECTS)} (테스트)`,
        from_address: `contact@${company.toLowerCase()}.test`,
        from_name: `${company} 담당자`,
        to_addresses: [{ name: actor.employee.fullName, email: actor.employee.email }],
        sent_at: new Date().toISOString(),
        body_text: "테스트용 더미 메일 본문입니다. 실제 메일이 아닙니다.",
        snippet: "테스트용 더미 메일 본문입니다...",
        has_attachments: false,
        is_read: Math.random() < 0.5,
      });
      if (error) lastError = error.message;
      else created++;
    }
  }

  return { board: "메일함(mail)", created, error: lastError };
}
