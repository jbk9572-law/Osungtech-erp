"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

export async function upsertCalendarNote(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const noteDate = String(formData.get("note_date") ?? "");
  const content = String(formData.get("content") ?? "");
  if (!noteDate) {
    return { error: "날짜 정보가 없습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("calendar_notes")
    .upsert(
      { note_date: noteDate, content, created_by: user?.id ?? null },
      { onConflict: "note_date" }
    );

  if (error) {
    return { error: "메모 저장에 실패했습니다." };
  }

  revalidatePath("/dashboard");
  return { success: "메모가 저장되었습니다." };
}
