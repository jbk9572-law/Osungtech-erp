"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

// 하루에 메모 한 칸을 덮어쓰는 대신, 여러 사람이 그날그날 적은 메모가
// 로그처럼 쌓이도록 매번 새 행을 추가한다(calendar_notes에 더 이상
// note_date UNIQUE 제약이 없다 — migration 78 참고).
export async function addCalendarNote(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const noteDate = String(formData.get("note_date") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!noteDate) {
    return { error: "날짜 정보가 없습니다." };
  }
  if (!content) {
    return { error: "메모 내용을 입력해주세요." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("calendar_notes")
    .insert({ note_date: noteDate, content, created_by: user?.id ?? null });

  if (error) {
    return { error: `메모 저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/dashboard");
  return { success: "메모를 추가했습니다." };
}
