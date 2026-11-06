"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

// 실제 안전장치(샌드박스 테넌트인지/관리자인지)는 sandbox_reset() RPC
// 안에서 전부 확인한다(migration 212) — 여기서는 그대로 호출만 한다.
export async function resetSandbox(_prevState: FormState, _formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("sandbox_reset");
  if (error) return { error: `초기화에 실패했습니다: ${error.message}` };

  revalidatePath("/", "layout");
  return { success: "초기화했습니다." };
}

export async function seedSandbox(_prevState: FormState, _formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("sandbox_seed");
  if (error) return { error: `더미 데이터 생성에 실패했습니다: ${error.message}` };

  revalidatePath("/", "layout");
  return { success: "더미 데이터를 생성했습니다." };
}
