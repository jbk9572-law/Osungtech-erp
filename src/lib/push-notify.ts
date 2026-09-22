import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/server-env";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// VAPID 키가 아직 배포 환경변수에 없을 수 있다(선택 기능) — 그때는
// 조용히 아무것도 안 보내고 넘어간다(기존 화면 동작에는 영향 없음).
function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = getServerEnv("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:support@elvonix.app", publicKey, privateKey);
  return true;
}

// 결재자 본인이 아닌 "다른 사람"에게 보내는 알림이라 RLS로는 그 사람의
// 구독 정보를 조회할 수 없다 — 발송 전용으로 admin 클라이언트를 쓴다.
async function sendToUsers(userIds: string[], payload: { title: string; body: string; url: string }) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;
  if (!configureWebPush()) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", uniqueIds);
  if (!subs?.length) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
      } catch (err: unknown) {
        // 브라우저에서 구독이 만료/해지됐으면(410 Gone, 404 Not Found) 이
        // 서버에도 조용히 정리한다 — 안 그러면 죽은 구독에 매번 실패한다.
        const statusCode = (err as { statusCode?: number } | null)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("push 발송 실패:", err);
        }
      }
    }),
  );
}

// 기안 등록 직후, 또는 결재 처리 직후(반려/최종승인이 아니라 다음 결재자로
// 넘어간 경우) 공통으로 부르는 함수 — 지금 이 문서가 "누구 차례인지"를
// 다시 조회해서 그 사람에게만 알린다. 문서가 승인/반려로 끝났으면 대신
// 기안자에게 결과를 알린다. 두 경우를 한 함수로 합쳐서, 제출 시점과
// 결재 처리 시점 양쪽에서 그대로 재사용한다.
export async function notifyApprovalDocumentEvent(
  supabase: SupabaseClient<Database>,
  documentId: string,
): Promise<void> {
  const { data: doc } = await supabase
    .from("approval_documents")
    .select("title, status, created_by")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return;

  const url = `/approvals/${documentId}`;

  if (doc.status === "pending") {
    const { data: nextStep } = await supabase
      .from("approval_steps")
      .select("approver_id")
      .eq("document_id", documentId)
      .eq("status", "pending")
      .order("step_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextStep?.approver_id) {
      await sendToUsers([nextStep.approver_id], {
        title: "새 결재 요청",
        body: doc.title,
        url,
      });
    }
    return;
  }

  if (doc.created_by) {
    await sendToUsers([doc.created_by], {
      title: doc.status === "approved" ? "결재가 승인되었습니다" : "결재가 반려되었습니다",
      body: doc.title,
      url,
    });
  }
}
