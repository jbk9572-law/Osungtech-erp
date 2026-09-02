"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMutatedRow } from "@/lib/require-mutated-row";
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
    return { error: `등록에 실패했습니다${error ? `: ${error.message}` : ""}` };
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
  const result = await supabase
    .from("announcements")
    .update({ title, content, pinned })
    .eq("id", id)
    .select("id");

  const updateError = requireMutatedRow(result, {
    onError: "수정에 실패했습니다",
    onForbidden: "수정에 실패했습니다. 본인이 등록한 공지만 수정할 수 있습니다.",
  });
  if (updateError) return updateError;

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
  const result = await supabase.from("announcements").delete().eq("id", id).select("id");

  const deleteError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "삭제에 실패했습니다. 본인이 등록한 공지만 삭제할 수 있습니다.",
  });
  if (deleteError) return deleteError;

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  redirect("/announcements");
}

export async function toggleAnnouncementRead(formData: FormData): Promise<{ error: string } | undefined> {
  const id = String(formData.get("id") ?? "");
  const currentlyRead = formData.get("read") === "true";
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = currentlyRead
    ? await supabase.from("announcement_reads").delete().eq("announcement_id", id).eq("user_id", user.id)
    : await supabase
        .from("announcement_reads")
        .upsert({ announcement_id: id, user_id: user.id }, { onConflict: "announcement_id,user_id" });

  if (error) {
    return { error: `읽음 처리에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
}
