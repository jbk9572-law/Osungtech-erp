"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function createAnnouncement(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const pinned = formData.get("pinned") === "on";

  if (!title) {
    return { error: "제목을 입력해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("announcements")
    .insert({ title, content, pinned, created_by: user?.id ?? null })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "등록에 실패했습니다." };
  }

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  redirect(`/announcements/${data.id}`);
}

export async function updateAnnouncement(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const pinned = formData.get("pinned") === "on";

  if (!id || !title) {
    return { error: "제목을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({ title, content, pinned })
    .eq("id", id);

  if (error) {
    return { error: "수정에 실패했습니다." };
  }

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  redirect(`/announcements/${id}`);
}

export async function deleteAnnouncement(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);

  if (error) {
    return { error: "삭제에 실패했습니다." };
  }

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  redirect("/announcements");
}

export async function markAnnouncementRead(announcementId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("announcement_reads")
    .upsert({ announcement_id: announcementId, user_id: user.id }, { onConflict: "announcement_id,user_id" });
}
