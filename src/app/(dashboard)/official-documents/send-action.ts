"use server";

// sendOfficialDocument만 별도 파일로 뺐다 — 이 함수가 쓰는
// lib/mail/smtp-send.ts는 worker-mailer(cloudflare:sockets 기반)를
// 불러오는데, 이 모듈을 다른 액션들과 같은 파일에 두면 서버 컴포넌트
// (official-documents/[id]/page.tsx)가 그 파일을 직접 import할 때
// cloudflare:sockets까지 같은 서버 번들에 끌려 들어가 next build의
// "Collect page data" 단계에서 그 모듈을 못 찾아 빌드가 깨진다(로컬
// Node 빌드 환경엔 없는 모듈이라). 이 함수를 필요로 하는 발송 버튼
// (SendOfficialDocumentButton)만 클라이언트 컴포넌트에서 직접 import해
// 서버 액션 참조로만 쓰게 하고, 페이지 자체의 서버 모듈 그래프에는
// 안 들어가게 분리한다 — src/app/(dashboard)/mail/page.tsx가
// ComposeMailButton을 통해 mail/actions.ts의 sendMailAction을 같은
// 방식으로 격리해둔 것과 동일한 이유.
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/mail/crypto";
import { sendMail } from "@/lib/mail/smtp-send";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import type { FormState } from "@/components/form-message";

// 승인된 공문을 발송 처리한다. 이메일이 있는 외부 수신처는 기안자 본인의
// 연동 메일 계정(설정 > 메일 계정 연동)으로 실제 발송을 시도하고, 실패한
// 곳/이메일이 없는 곳/사내 수신처가 아닌 나머지는 "직접 발송 처리"
// 버튼으로 나중에 개별 완료 처리한다(팩스·우편·방문 전달 등) — 사내
// 수신처는 이 시점에 바로 "발송"으로 표시한다(사내 열람 권한은 이미
// official_document_recipients 행 자체로 부여돼 있어, 실제 알림 발송
// 채널이 따로 없어도 "받은 공문함"에서 바로 보인다).
export async function sendOfficialDocument(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "인증되지 않은 요청입니다." };

  const { data: doc } = await supabase
    .from("official_documents")
    .select("id, title, body, status, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { error: "공문을 찾을 수 없습니다." };
  if (doc.created_by !== user.id) return { error: "본인이 작성한 공문만 발송할 수 있습니다." };
  if (doc.status !== "approved") return { error: "결재가 완료된 공문만 발송할 수 있습니다." };

  const { data: recipients } = await supabase
    .from("official_document_recipients")
    .select("id, kind, name, email, user_id, status")
    .eq("official_document_id", id);

  const { data: account } = await supabase
    .from("mail_accounts")
    .select("email_address, display_name, smtp_host, smtp_port, username, encrypted_app_password")
    .eq("user_id", user.id)
    .maybeSingle();

  // 여기서부터는 관리자 클라이언트로 쓴다 — official_documents/
  // official_document_recipients의 update 정책은 작성중(draft) 상태
  // 전용이라(actions.ts의 설계 주석 참고), 발송 이후 상태 전이는 이 서버
  // 액션이 이미 위에서 마친 소유자·상태 확인을 근거로 RLS를 우회해 처리한다.
  const admin = createAdminClient();

  let sentCount = 0;
  let failedCount = 0;
  let manualCount = 0;

  for (const r of recipients ?? []) {
    // 문서 상태 갱신 실패로 재시도할 때, 이미 처리된 수신처까지 다시
    // 메일을 보내지 않게 한다(아래 requireMutatedRow 실패 시 재시도가
    // 안전하려면 이 건너뛰기가 필요하다).
    if (r.status === "sent" || r.status === "delivered_manual") continue;
    if (r.kind === "internal") {
      const { error: markSentError } = await admin
        .from("official_document_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", r.id);
      if (markSentError) console.error("사내 수신처 상태 갱신 실패:", markSentError.message);
      sentCount++;
      continue;
    }

    if (!r.email || !account) {
      manualCount++;
      continue;
    }

    try {
      const password = await decryptSecret(account.encrypted_app_password);
      await sendMail({
        smtpHost: account.smtp_host,
        smtpPort: account.smtp_port,
        username: account.username,
        password,
        fromEmail: account.email_address,
        fromName: account.display_name,
        to: [r.email],
        subject: doc.title,
        text: doc.body,
      });
      const { error: markSentError } = await admin
        .from("official_document_recipients")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", r.id);
      if (markSentError) console.error("발송 성공 후 상태 갱신 실패:", markSentError.message);
      sentCount++;
    } catch (err) {
      const { error: markBouncedError } = await admin
        .from("official_document_recipients")
        .update({ status: "bounced", bounce_reason: err instanceof Error ? err.message : String(err) })
        .eq("id", r.id);
      if (markBouncedError) console.error("발송 실패 상태 갱신 실패:", markBouncedError.message);
      failedCount++;
    }
  }

  const markDocSentResult = await admin
    .from("official_documents")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  const markDocSentMutationError = requireMutatedRow(
    markDocSentResult,
    "각 수신처 발송 처리는 끝났지만 문서 상태 갱신에 실패했습니다. 다시 발송 처리를 눌러주세요(이미 발송된 수신처는 다시 보내지 않습니다)",
  );
  if (markDocSentMutationError) return markDocSentMutationError;

  revalidatePath(`/official-documents/${id}`);
  revalidatePath("/official-documents");

  const parts = [`발송완료 처리했습니다. 이메일 발송 ${sentCount}건`];
  if (failedCount > 0) parts.push(`발송 실패 ${failedCount}건`);
  if (manualCount > 0) parts.push(`직접 발송 필요 ${manualCount}건(이메일 없음 또는 메일 계정 미연동)`);
  return { success: parts.join(", ") };
}
