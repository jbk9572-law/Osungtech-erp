import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// 뮤테이션 실패를 CODE+한글설명으로 failure_logs에 남긴다
// (플랫폼관리자 > 실패 로그에서 확인 가능). 호출부는 if (error) 처리
// 안에서 이 함수를 같이 불러주면 된다 — 적재 자체가 실패해도 원래
// 하던 작업(에러 메시지를 화면에 보여주는 것)은 절대 막지 않는다.
export async function logOperationFailure(
  supabase: SupabaseServerClient,
  params: {
    code: string;
    messageKo: string;
    action: string;
    entityType?: string;
    entityId?: string;
    detail?: string;
    context?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("failure_logs").insert({
      code: params.code,
      message_ko: params.messageKo,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      detail: params.detail ?? null,
      context: (params.context as Json | undefined) ?? null,
    });
  } catch {
    // 로그 적재 실패는 조용히 무시한다.
  }
}
