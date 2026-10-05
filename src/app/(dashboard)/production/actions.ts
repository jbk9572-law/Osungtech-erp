"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

// 생산지시 등록(migration 161 이후) — 더 이상 재고를 바로 움직이지
// 않는다. create_work_order() RPC는 지시 자체와(제품에 공정 라우팅이
// 있으면) 공정 체크리스트만 만들고, 실제 재고는 아래 자재투입/생산완료
// 두 동작으로 각각 옮긴다.
export async function createWorkOrder(_prevState: FormState, formData: FormData): Promise<FormState> {
  const productId = String(formData.get("product_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const orderDate = String(formData.get("order_date") ?? "");
  const memo = String(formData.get("memo") ?? "").trim() || null;

  if (!productId || !warehouseId || !orderDate) {
    return { error: "완제품, 창고, 지시일자를 모두 입력해주세요." };
  }
  if (!(quantity > 0)) {
    return { error: "생산 수량은 0보다 커야 합니다." };
  }

  const supabase = await createClient();
  const { data: workOrderId, error } = await supabase.rpc("create_work_order", {
    p_product_id: productId,
    p_warehouse_id: warehouseId,
    p_quantity: quantity,
    p_order_date: orderDate,
    p_memo: memo,
  });

  if (error || !workOrderId) {
    return { error: `생산지시 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/production");
  revalidatePath("/inventory");
  redirect("/production");
}

export async function deleteWorkOrder(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_work_order", { p_id: id });
  if (error) {
    return { error: `삭제에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/production");
  revalidatePath("/inventory");
  return { success: "생산지시를 삭제했습니다." };
}

export async function issueWorkOrderMaterials(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_work_order_materials", { p_id: id });
  if (error) {
    return { error: `자재투입 처리에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/production");
  revalidatePath("/inventory");
  return { success: "자재투입 처리했습니다." };
}

export async function completeWorkOrder(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_work_order", { p_id: id });
  if (error) {
    return { error: `생산완료 처리에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/production");
  revalidatePath("/inventory");
  return { success: "생산완료 처리했습니다." };
}

export async function updateWorkOrderProcessStep(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["pending", "in_progress", "done", "shipped"].includes(status)) {
    return { error: "잘못된 요청입니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_work_order_process_step", { p_id: id, p_status: status });
  if (error) {
    return { error: `공정 상태 변경에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/production");
  if (workOrderId) revalidatePath(`/production/${workOrderId}`);
  return { success: "공정 상태를 변경했습니다." };
}

// 공정 단계를 내부(사내)에서 처리할지, 특정 하청업체에 맡길지 배정한다
// — subcontractor_id가 비어 있으면(또는 "internal") 내부로 되돌린다.
export async function assignWorkOrderProcessStep(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const subcontractorIdRaw = String(formData.get("subcontractor_id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_work_order_process_step", {
    p_id: id,
    p_subcontractor_id: subcontractorIdRaw || null,
  });
  if (error) {
    return { error: `공정 배정 변경에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/production");
  if (workOrderId) revalidatePath(`/production/${workOrderId}`);
  return { success: "공정 배정을 변경했습니다." };
}

// 업체 등록(하청업체관리)과 공정 배정(생산지시 상세)이 서로 다른 화면에
// 나뉘어 있어 "이 업체 아직 등록 안 했는데 어디서 만들지?" 하고 매번
// 하청업체관리로 건너갔다 돌아와야 했다 — 생산지시 상세에서 업체명만
// 입력하면 바로 등록하고 그 자리에서 이 단계에 배정까지 끝낸다(상세
// 정보는 나중에 하청업체관리에서 보완하면 된다).
export async function createAndAssignSubcontractor(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return { error: "업체명을 입력해주세요." };

  const supabase = await createClient();
  const { data: created, error: createError } = await supabase
    .from("subcontractors")
    .insert({ name })
    .select("id")
    .single();
  if (createError || !created) {
    return { error: `업체 등록에 실패했습니다: ${createError?.message ?? "알 수 없는 오류"}` };
  }

  const { error: assignError } = await supabase.rpc("assign_work_order_process_step", {
    p_id: id,
    p_subcontractor_id: created.id,
  });
  if (assignError) {
    return { error: `업체는 등록됐지만 배정에 실패했습니다: ${assignError.message}` };
  }

  revalidatePath("/production");
  revalidatePath("/subcontractors");
  if (workOrderId) revalidatePath(`/production/${workOrderId}`);
  return { success: `${name} 업체를 등록하고 배정했습니다.` };
}
