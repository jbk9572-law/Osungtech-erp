"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import type { FormState } from "@/components/form-message";

// 운영자 문의 등록 — 답변은 플랫폼 운영자만 reply_support_ticket()
// RPC로 남길 수 있다(migration 136). 작성/조회는 관리자+매니저만
// 가능하다(일반 직원이 쓰는 채널이 아니라 회사를 대표해 운영자와
// 소통하는 공식 채널로 본다) — RLS(support_tickets_insert_manager_or_
// admin)가 최종 방어선이지만, 날것의 DB 에러 대신 분명한 메시지로
// 먼저 막는다.
export async function createSupportTicket(_prevState: FormState, formData: FormData): Promise<FormState> {
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!subject || !message) {
    return { error: "제목과 문의 내용을 입력해주세요." };
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { isManagerOrAdmin } = await getCurrentActor(supabase);
  if (!isManagerOrAdmin) {
    return { error: "운영자 문의는 관리자/매니저만 작성할 수 있습니다." };
  }

  const { error } = await supabase.from("support_tickets").insert({
    subject,
    message,
    created_by: user.id,
  });
  if (error) return { error: `문의 등록에 실패했습니다: ${error.message}` };

  revalidatePath("/settings/support");
  return { success: "문의를 등록했습니다. 답변이 등록되면 이 화면에서 확인할 수 있습니다." };
}
