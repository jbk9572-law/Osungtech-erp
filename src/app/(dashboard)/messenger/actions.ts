"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function sendMessage(_prevState: FormState, formData: FormData): Promise<FormState> {
  const content = String(formData.get("content") ?? "").trim();
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (!content && !hasFile) {
    return { error: "메시지나 파일을 입력해주세요." };
  }
  if (hasFile && file.size > MAX_FILE_SIZE) {
    return { error: "파일은 20MB 이하만 첨부할 수 있습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  let fileUrl: string | null = null;
  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;

  if (hasFile && file instanceof File) {
    const safeName = file.name.replace(/[^\w.\-가-힣 ]/g, "_");
    const path = `${user.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("messenger-attachments")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });

    if (uploadError) {
      return { error: "파일 업로드에 실패했습니다." };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("messenger-attachments").getPublicUrl(path);
    fileUrl = publicUrl;
    filePath = path;
    fileName = file.name;
    fileSize = file.size;
  }

  const { error } = await supabase.from("messenger_messages").insert({
    sender_id: user.id,
    content,
    file_url: fileUrl,
    file_path: filePath,
    file_name: fileName,
    file_size: fileSize,
  });

  if (error) {
    return { error: "전송에 실패했습니다." };
  }

  revalidatePath("/messenger");
  return { success: "전송했습니다." };
}

export async function deleteMessage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const filePath = String(formData.get("file_path") ?? "");
  if (!id) return;

  const supabase = await createClient();

  if (filePath) {
    await supabase.storage.from("messenger-attachments").remove([filePath]);
  }
  await supabase.from("messenger_messages").delete().eq("id", id);

  revalidatePath("/messenger");
}
