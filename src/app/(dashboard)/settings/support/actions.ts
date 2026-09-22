"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

// 고객지원 문의 등록 — 답변은 플랫폼 운영자만 reply_support_ticket()
// RPC로 남길 수 있다(migration 136). 일반 사용자는 등록/조회만 한다.
export async function createSupportTicket(_prevState: FormState, formData: FormData): Promise<FormState> {
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!subject || !message) {
    return { error: "제목과 문의 내용을 입력해주세요." };
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase.from("support_tickets").insert({
    subject,
    message,
    created_by: user.id,
  });
  if (error) return { error: `문의 등록에 실패했습니다: ${error.message}` };

  revalidatePath("/settings/support");
  return { success: "문의를 등록했습니다. 답변이 등록되면 이 화면에서 확인할 수 있습니다." };
}
