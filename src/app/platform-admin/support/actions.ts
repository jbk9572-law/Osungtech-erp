"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import type { FormState } from "@/components/form-message";

export async function replySupportTicket(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "권한이 없습니다." };

  const id = String(formData.get("id") ?? "");
  const reply = String(formData.get("reply") ?? "").trim();
  const status = String(formData.get("status") ?? "answered");
  if (!id || !reply) return { error: "답변 내용을 입력해주세요." };

  const { error } = await supabase.rpc("reply_support_ticket", {
    p_id: id,
    p_reply: reply,
    p_status: status,
  });
  if (error) return { error: `답변 등록에 실패했습니다: ${error.message}` };

  revalidatePath("/platform-admin/support");
  return { success: "답변을 등록했습니다." };
}
