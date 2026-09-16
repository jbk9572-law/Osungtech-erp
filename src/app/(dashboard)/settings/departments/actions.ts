"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";
import { requireMutatedRow } from "@/lib/require-mutated-row";

export async function createDepartment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parent_department_id") ?? "") || null;

  if (!name) return { error: "부서명을 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.from("departments").insert({ name, parent_department_id: parentId });

  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/settings/departments");
  return { success: "부서를 추가했습니다." };
}

export async function updateDepartment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parent_department_id") ?? "") || null;

  if (!id || !name) return { error: "부서명을 입력해주세요." };
  if (parentId === id) return { error: "자기 자신을 상위 부서로 지정할 수 없습니다." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .update({ name, parent_department_id: parentId })
    .eq("id", id);

  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/settings/departments");
  return { success: "저장했습니다." };
}

export async function deleteDepartment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("departments").delete().eq("id", id).select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "삭제에 실패했습니다",
    onForbidden: "관리자만 삭제할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/settings/departments");
  return { success: "삭제했습니다. 하위 부서/소속 직원은 미배정으로 남습니다." };
}

export async function setEmployeeDepartment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const userId = String(formData.get("user_id") ?? "");
  const departmentId = String(formData.get("department_id") ?? "") || null;
  const positionTitle = String(formData.get("position_title") ?? "").trim() || null;

  if (!userId) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ department_id: departmentId, position_title: positionTitle })
    .eq("id", userId);

  if (error) return { error: `저장에 실패했습니다: ${error.message}` };

  revalidatePath("/settings/departments");
  revalidatePath("/settings/users");
  return { success: "저장했습니다." };
}
