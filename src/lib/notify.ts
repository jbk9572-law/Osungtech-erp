import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/server-env";

// VAPID 키가 아직 배포 환경변수에 없을 수 있다(선택 기능) — 그때는
// 조용히 푸시만 건너뛰고 DB 기록은 그대로 남긴다.
function configureWebPush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = getServerEnv("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails("mailto:support@elvonix.app", publicKey, privateKey);
  return true;
}

export type NotifyInput = {
  userIds: string[];
  // 자유 문자열 — migration 159 참고(체크 제약 없이 계속 늘어날 수 있음).
  type: string;
  title: string;
  body?: string;
  url?: string;
  // 이 알림이 가리키는 원본 행 id(메신저 메시지, 공지, 결재문서 등) —
  // 지금은 화면에서 직접 쓰지 않지만 notification_events 컬럼에 맞춰 둔다.
  sourceId?: string;
};

// 메신저 DM/그룹, 공지, 결재 등 알림을 보내는 곳이 전부 이 함수 하나를
// 거친다 — notification_events에 이벤트 행을 남기고(나중에 메일/메신저와
// 합쳐질 알림함 UI가 여기서 조회한다), 동시에 그 사람이 지금 구독해둔
// 브라우저가 있으면 web-push까지 같이 보낸다. 수신자 본인이 아닌 "다른
// 사람" 앞으로 쓰는 거라 관리자 클라이언트(service role)를 쓰는데,
// service role은 auth.uid()가 없어 tenant_id/is_demo 컬럼 기본값이 제대로
// 안 채워진다 — 그래서 호출자의 일반 클라이언트(supabase)로 먼저 그 값을
// 구해서 매번 명시적으로 넘긴다. 요청 컨텍스트(로그인 세션) 자체가 없는
// 크론 호출(메일 동기화 등)은 대신 notifyForTenant()를 쓴다.
export async function notify(supabase: SupabaseClient<Database>, input: NotifyInput): Promise<void> {
  const [{ data: tenantId }, { data: isDemo }] = await Promise.all([
    supabase.rpc("current_tenant_id"),
    supabase.rpc("is_demo_actor"),
  ]);
  if (!tenantId) return;

  await notifyForTenant({ tenantId, isDemo: isDemo ?? false, ...input });
}

// notify()와 같은 일을 하지만, 로그인 세션이 아예 없는 곳(메일 주기적
// 동기화 크론 등)에서 쓴다 — tenant_id/is_demo를 RPC로 구하는 대신 이미
// 알고 있는 값(예: mail_accounts 행 자체의 tenant_id/is_demo 컬럼)을
// 그대로 받는다.
export async function notifyForTenant(
  input: NotifyInput & { tenantId: string; isDemo: boolean },
): Promise<void> {
  const userIds = Array.from(new Set(input.userIds.filter(Boolean)));
  if (userIds.length === 0) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return;
  }

  const { error } = await admin.from("notification_events").insert(
    userIds.map((userId) => ({
      tenant_id: input.tenantId,
      is_demo: input.isDemo,
      user_id: userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      source_id: input.sourceId ?? null,
      is_read: false,
    })),
  );
  if (error) console.error("notification_events insert 실패:", error);

  await sendPush(admin, userIds, { title: input.title, body: input.body ?? "", url: input.url ?? "/" });
}

async function sendPush(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[],
  payload: { title: string; body: string; url: string },
) {
  if (!configureWebPush()) return;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
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
