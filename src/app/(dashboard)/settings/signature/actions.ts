"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { detectRasterImageType } from "@/lib/upload-safety";
import type { FormState } from "@/components/form-message";

// 서명 이미지는 회사 로고/도장과 같은 storage 버킷('branding')의
// signatures/ 경로 아래에 본인 id로 저장한다 — 새 버킷을 또 만들지 않고
// 기존 정책(로그인 사용자 쓰기 허용)을 그대로 재사용한다. 경로는 클라이언트가
// 정하지 못하게 항상 auth.uid()로부터 서버에서 직접 만든다.
export async function uploadSignatureImage(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "인증되지 않은 요청입니다." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "서명 이미지 파일을 선택해주세요." };
  }
  const detectedType = await detectRasterImageType(file);
  if (!detectedType) {
    return { error: "PNG, JPG, GIF, WEBP 형식의 이미지 파일만 업로드할 수 있습니다." };
  }

  const { data: isDemo, error: isDemoError } = await supabase.rpc("is_demo_actor");
  if (isDemoError) {
    return { error: `계정 종류를 확인하지 못해 업로드를 중단했습니다: ${isDemoError.message}` };
  }
  const path = isDemo ? `signatures/demo/${user.id}.png` : `signatures/${user.id}.png`;

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(path, file, { upsert: true, contentType: detectedType });
  if (uploadError) {
    return { error: `이미지 업로드에 실패했습니다: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("branding").getPublicUrl(path);
  const url = `${publicUrl}?t=${Date.now()}`;

  const { error } = await supabase.rpc("update_own_signature", { p_url: url });
  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/settings/signature");
  revalidatePath("/approvals", "layout");
  return { success: "서명 이미지가 저장되었습니다." };
}

export async function resetSignatureImage(_prevState: FormState): Promise<FormState> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "인증되지 않은 요청입니다." };

  const { error } = await supabase.rpc("update_own_signature", { p_url: null });
  if (error) return { error: `삭제에 실패했습니다: ${error.message}` };

  revalidatePath("/settings/signature");
  revalidatePath("/approvals", "layout");
  return { success: "서명 이미지를 삭제했습니다." };
}
