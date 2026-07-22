"use server";

import { createClient } from "@/lib/supabase/server";
import type { MessengerMessage } from "@/lib/messenger-types";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export type SendMessageState =
  | { error?: string; success?: string; message?: MessengerMessage }
  | undefined;

export async function sendMessage(
  _prevState: SendMessageState,
  formData: FormData
): Promise<SendMessageState> {
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
    // Supabase 스토리지 키는 한글 등 비ASCII 문자를 거부한다("Invalid key" 에러).
    // 원본 파일명은 file_name 컬럼에 그대로 저장해 화면 표시/다운로드에 쓰고,
    // 실제 저장 경로는 확장자만 남긴 ASCII 전용 키로 만든다.
    const extMatch = file.name.match(/\.[A-Za-z0-9]+$/);
    const ext = extMatch ? extMatch[0].toLowerCase() : "";
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("messenger-attachments")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });

    if (uploadError) {
      console.error("messenger file upload failed:", uploadError);
      return { error: `파일 업로드에 실패했습니다. (${uploadError.message})` };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("messenger-attachments").getPublicUrl(path);
    fileUrl = publicUrl;
    filePath = path;
    fileName = file.name;
    fileSize = file.size;
  }

  const { data: inserted, error } = await supabase
    .from("messenger_messages")
    .insert({
      sender_id: user.id,
      content,
      file_url: fileUrl,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
    })
    .select("id, sender_id, content, file_url, file_path, file_name, file_size, created_at")
    .single();

  if (error || !inserted) {
    console.error("messenger message insert failed:", error);
    return { error: `전송에 실패했습니다.${error ? ` (${error.message})` : ""}` };
  }

  return { success: "전송했습니다.", message: inserted };
}

export async function deleteMessage(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // messenger_messages의 RLS는 본인 메시지만 삭제할 수 있게 막아두었지만,
  // 스토리지 버킷 쪽 삭제 정책은 로그인한 사용자면 누구든 파일을 지울 수
  // 있게 되어 있다(경로 소유자 체크 없음). 그 정책을 좁히기 전까지는
  // 여기서도 본인 메시지인지 먼저 확인해야, 다른 사람 메시지 첨부파일이
  // (메시지 행은 안 지워진 채로) 조용히 삭제되는 사고를 막을 수 있다.
  // file_path도 폼에서 그대로 믿지 않고 DB에서 다시 조회한다.
  const { data: message } = await supabase
    .from("messenger_messages")
    .select("sender_id, file_path")
    .eq("id", id)
    .maybeSingle();
  if (!message || message.sender_id !== user.id) return;

  if (message.file_path) {
    await supabase.storage.from("messenger-attachments").remove([message.file_path]);
  }
  await supabase.from("messenger_messages").delete().eq("id", id);
}
