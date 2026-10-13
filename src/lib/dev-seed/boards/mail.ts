import type { ActingSession, BoardSeedResult, Db, PlatformAdminMember } from "../types";
import { MAIL_SUBJECTS, pick, randomCompanyName } from "../korean-data";

const MAIL_ACTOR_COUNT = 3;

// 메일 계정 하나 + 더미 메일 몇 통을 만든다. client는 꼭 로그인 세션일
// 필요 없다 — 더미 직원은 actor.client(그 직원으로 로그인한 세션)를
// 넘기고, 플랫폼관리자는 비밀번호를 모르니 서비스 롤 admin 클라이언트를
// 그대로 넘긴다(user_id를 직접 지정해서 꽂아 넣는 방식).
async function seedMailFor(
  client: Db,
  // 로그인 세션(actor.client)에는 JWT에 테넌트가 실려 있어 tenant_id
  // 컬럼 기본값(current_tenant_id())이 알아서 채워지지만, 서비스 롤
  // admin 클라이언트는 세션이 없어 그 기본값이 null로 평가된다(departments
  // 생성 때와 같은 이유) — 플랫폼관리자 몫을 넣을 때를 대비해 항상
  // 명시적으로 넘긴다.
  tenantId: string,
  userId: string,
  email: string,
  fullName: string,
  username: string,
  count: number,
): Promise<{ created: number; error?: string }> {
  let created = 0;
  let lastError: string | undefined;

  const { data: existingAccount, error: accountLookupError } = await client
    .from("mail_accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (accountLookupError) return { created: 0, error: accountLookupError.message };

  let accountId = existingAccount?.id;
  if (!accountId) {
    const { data: created_, error: createError } = await client
      .from("mail_accounts")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        email_address: email,
        display_name: `${fullName} (테스트)`,
        username,
        encrypted_app_password: "dev-seed-placeholder",
        is_active: false,
      })
      .select("id")
      .single();
    if (createError || !created_) return { created: 0, error: createError?.message ?? "더미 메일 계정 생성 실패" };
    accountId = created_.id;
  }

  const { data: maxUidRow } = await client
    .from("mail_messages")
    .select("uid")
    .eq("mail_account_id", accountId)
    .order("uid", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextUid = (maxUidRow?.uid ?? 0) + 1;

  for (let i = 0; i < count; i++) {
    const company = randomCompanyName();
    const { error } = await client.from("mail_messages").insert({
      tenant_id: tenantId,
      mail_account_id: accountId,
      user_id: userId,
      folder: "INBOX",
      uid: nextUid++,
      subject: `${pick(MAIL_SUBJECTS)} (테스트)`,
      from_address: `contact@${company.toLowerCase()}.test`,
      from_name: `${company} 담당자`,
      to_addresses: [{ name: fullName, email }],
      sent_at: new Date().toISOString(),
      body_text: "테스트용 더미 메일 본문입니다. 실제 메일이 아닙니다.",
      snippet: "테스트용 더미 메일 본문입니다...",
      has_attachments: false,
      is_read: Math.random() < 0.5,
    });
    if (error) lastError = error.message;
    else created++;
  }

  return { created, error: lastError };
}

// 실제 IMAP 계정 없이 메일함 화면을 테스트할 수 있게, is_active=false인
// "가짜" 메일 계정을 몇 명의 더미 직원 + 플랫폼관리자에게 하나씩
// 붙여준다 — is_active=false라서 실제 동기화 크론(syncAllMailAccounts)이
// 이 계정은 건드리지 않는다(.eq("is_active", true) 필터). 더미 직원의
// 메일을 보려면 해당 더미 직원 계정으로 로그인해야 한다(메일함은
// user_id 기준 개인함이라 다른 계정에서는 안 보임). 플랫폼관리자
// 몫은 지금 테스트 중인 실제 관리자 계정으로 로그인하면 바로 보인다 —
// "일괄작성만 테스트해볼 수 있고 내 계정으로는 아무것도 안 보인다"는
// 문제를 막기 위해 반드시 채운다(admin 서비스 롤로 user_id를 직접
// 지정해서 insert — 플랫폼관리자는 실제 사람 계정이라 비밀번호를 몰라
// 더미 직원처럼 로그인 세션을 만들 수 없다).
export async function seedMail(
  admin: Db,
  tenantId: string,
  actors: ActingSession[],
  platformAdmins: PlatformAdminMember[],
  count: number,
): Promise<BoardSeedResult> {
  const mailActors = actors.slice(0, MAIL_ACTOR_COUNT);
  let created = 0;
  let lastError: string | undefined;

  const perActorCount = Math.ceil(count / mailActors.length);
  for (const actor of mailActors) {
    const result = await seedMailFor(
      actor.client,
      tenantId,
      actor.employee.id,
      actor.employee.email,
      actor.employee.fullName,
      actor.employee.username,
      perActorCount,
    );
    created += result.created;
    if (result.error) lastError = result.error;
  }

  for (const admin_ of platformAdmins) {
    const result = await seedMailFor(
      admin,
      tenantId,
      admin_.id,
      admin_.email,
      admin_.fullName,
      admin_.email,
      perActorCount,
    );
    created += result.created;
    if (result.error) lastError = result.error;
  }

  return { board: "메일함(mail)", created, error: lastError };
}
