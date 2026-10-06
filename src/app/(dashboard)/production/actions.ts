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
  if (!id || !["pending", "received", "in_progress", "done", "shipped"].includes(status)) {
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

// 입고시 불량으로 보류된 공정을 원청(사내)에서 확인 후 해제한다 — 이전
// 공정/업체와 공유가 끝나 작업을 진행해도 된다고 판단했을 때 누른다.
export async function resolveStepDefectHold(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const workOrderId = String(formData.get("work_order_id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_step_defect_hold", { p_step_id: id });
  if (error) {
    return { error: `불량 보류 해제에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/production");
  if (workOrderId) revalidatePath(`/production/${workOrderId}`);
  return { success: "불량 보류를 해제했습니다. 작업을 진행할 수 있습니다." };
}

// 입고시 불량으로 보류된 공정을 "해결" 대신 "반품"으로 종료한다 —
// 외주검사반품(영림원 용어): 이 건은 재고/정산에 전혀 반영되지 않는다.
export async function rejectStepDefectHold(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const workOrderId = String(formData.get("work_order_id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_step_defect_hold", { p_step_id: id });
  if (error) {
    return { error: `반품 처리에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/production");
  if (workOrderId) revalidatePath(`/production/${workOrderId}`);
  return { success: "반품 처리했습니다." };
}

// 이미 완료/출고된 공정도 나중에 수량 반품이 가능하다(입고 후 반품) —
// 생산지시가 이미 완료돼 완제품이 창고에 들어와 있으면 그만큼 재고도
// 마이너스로 조정되고, 정산 금액은 반품 수량만큼 자동으로 줄어든다.
export async function returnWorkOrderProcessStepQuantity(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!id || !(quantity > 0)) {
    return { error: "반품 수량을 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("return_work_order_process_step_quantity", {
    p_step_id: id,
    p_quantity: quantity,
    p_note: note,
  });
  if (error) {
    return { error: `반품 처리에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/production");
  revalidatePath("/inventory");
  revalidatePath("/subcontractor-payables");
  if (workOrderId) revalidatePath(`/production/${workOrderId}`);
  return { success: "반품 처리했습니다." };
}

// 공정 배정 시 자동으로 채워진 단가를, 생산지시 상세에서 그 자리에서
// 수정할 수 있게.
export async function setStepUnitCost(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const workOrderId = String(formData.get("work_order_id") ?? "");
  const unitCostRaw = String(formData.get("unit_cost") ?? "").trim();
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_work_order_process_step_unit_cost", {
    p_id: id,
    p_unit_cost: unitCostRaw ? Number(unitCostRaw) : null,
  });
  if (error) {
    return { error: `단가 저장에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/production");
  revalidatePath("/subcontractor-payables");
  if (workOrderId) revalidatePath(`/production/${workOrderId}`);
  return { success: "단가를 저장했습니다." };
}

// 1차 공정이 외주로 배정된 생산지시의 자재투입 — 우리 창고 차감은
// issueWorkOrderMaterials와 같지만, 동시에 그 수량을 업체 보유재고로
// 넘긴다(issue_work_order_materials_to_subcontractor RPC).
export async function issueWorkOrderMaterialsToSubcontractor(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_work_order_materials_to_subcontractor", { p_id: id });
  if (error) {
    return { error: `외주 자재출고에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/production");
  revalidatePath("/inventory");
  revalidatePath("/subcontractors");
  return { success: "외주 자재출고 처리했습니다." };
}
