"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { getUser } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

// 대시보드 레이아웃 상단 배너에 그대로 노출되므로, 저장/토글/삭제 후
// 모든 테넌트의 대시보드가 다시 보이도록 레이아웃까지 무효화한다.
function revalidateEverywhere() {
  revalidatePath("/platform-admin/announcements");
  revalidatePath("/", "layout");
}

export async function createPlatformAnnouncement(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 공지를 등록할 수 있습니다." };

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title) return { error: "제목을 입력해주세요." };

  const user = await getUser();

  const { error } = await supabase.from("platform_announcements").insert({
    title,
    content: content || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: `등록에 실패했습니다: ${error.message}` };

  revalidateEverywhere();
  return { success: "공지를 등록했습니다." };
}

// OptimisticCheckbox(공용 낙관적 업데이트 체크박스)와 같은 계약:
// 넘어오는 필드 값은 "토글 전 현재값"이고, 여기서 그 반대값으로 뒤집는다.
export async function setPlatformAnnouncementActive(formData: FormData): Promise<{ error?: string } | undefined> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 변경할 수 있습니다." };

  const id = String(formData.get("id") ?? "");
  const currentlyActive = formData.get("is_active") === "true";
  if (!id) return { error: "잘못된 요청입니다." };

  const { error } = await supabase
    .from("platform_announcements")
    .update({ is_active: !currentlyActive })
    .eq("id", id);
  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidateEverywhere();
  return undefined;
}

export async function deletePlatformAnnouncement(_prevState: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isPlatformAdmin } = await requirePlatformAdmin();
  if (!isPlatformAdmin) return { error: "플랫폼 운영자만 삭제할 수 있습니다." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const { error } = await supabase.from("platform_announcements").delete().eq("id", id);
  if (error) return { error: `삭제에 실패했습니다: ${error.message}` };

  revalidateEverywhere();
  return { success: "삭제했습니다." };
}
