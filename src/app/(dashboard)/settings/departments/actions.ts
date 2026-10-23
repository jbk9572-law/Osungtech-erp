"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/form-message";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import { requireAdmin } from "@/lib/require-admin";

export async function createDepartment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parent_department_id") ?? "") || null;

  if (!name) return { error: "부서명을 입력해주세요." };

  // deleteDepartment는 이미 RLS 거부(0행)를 requireMutatedRow로 걸러서
  // "관리자만 삭제할 수 있습니다"로 안내하는데, 이 함수와 아래 update/
  // setEmployeeDepartment는 RLS가 막아도 .insert()/.update()가 error 없이
  // 조용히 끝나버려(RLS는 최종 방어선으로 여전히 동작하지만) 화면에는
  // "저장했습니다" 성공 메시지가 뜰 수 있었다(헌법검사 발견) — 이 앱의
  // 다른 관리자 전용 액션(settings/users/actions.ts 등)과 같이 앞에서
  // 먼저 명시적으로 막는다.
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 부서를 추가할 수 있습니다." };

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

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 부서를 수정할 수 있습니다." };

  // 1단계(자기 자신)뿐 아니라 몇 단계를 거슬러 올라가도 다시 자기 자신이
  // 나오는 순환(예: A의 상위를 B로 바꾼 뒤, 나중에 B의 상위를 다시 A로
  // 지정)도 막는다 — DB에도 같은 검사를 하는 트리거(migration 150)가
  // 최종 방어선으로 있지만, 여기서 먼저 걸러야 더 친절한 안내 문구를
  // 보여줄 수 있다.
  if (parentId) {
    let current: string | null = parentId;
    const visited = new Set<string>();
    while (current) {
      if (current === id) {
        return { error: "상위 부서를 순환 참조(원형 구조)로 지정할 수 없습니다." };
      }
      if (visited.has(current)) break;
      visited.add(current);
      const { data: parentRow }: { data: { parent_department_id: string | null } | null } = await supabase
        .from("departments")
        .select("parent_department_id")
        .eq("id", current)
        .maybeSingle();
      current = parentRow?.parent_department_id ?? null;
    }
  }

  const result = await supabase
    .from("departments")
    .update({ name, parent_department_id: parentId })
    .eq("id", id)
    .select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "저장에 실패했습니다",
    onForbidden: "관리자만 수정할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/settings/departments");
  return { success: "저장했습니다." };
}

export async function deleteDepartment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const { supabase } = await requireAdmin();
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

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "관리자만 소속 부서를 변경할 수 있습니다." };

  const result = await supabase
    .from("profiles")
    .update({ department_id: departmentId, position_title: positionTitle })
    .eq("id", userId)
    .select("id");
  const mutationError = requireMutatedRow(result, {
    onError: "저장에 실패했습니다",
    onForbidden: "관리자만 수정할 수 있습니다.",
  });
  if (mutationError) return mutationError;

  revalidatePath("/settings/departments");
  revalidatePath("/settings/users");
  return { success: "저장했습니다." };
}
