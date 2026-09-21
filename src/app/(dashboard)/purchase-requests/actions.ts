"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import { todayKstStr } from "@/lib/kst-date";
import type { FormState } from "@/components/form-message";

type PurchaseRequestItemInput = {
  productId: string;
  spec: string | null;
  quantity: number;
  estimatedUnitPrice: number;
  remark: string | null;
};

function parseItems(raw: string): PurchaseRequestItemInput[] {
  try {
    const items = JSON.parse(raw) as PurchaseRequestItemInput[];
    return Array.isArray(items) ? items.filter((i) => i.productId && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

export async function createPurchaseRequest(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supplierId = String(formData.get("supplier_id") ?? "").trim();
  const requestDate = String(formData.get("request_date") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!supplierId) return { error: "공급처를 선택해주세요." };
  if (items.length === 0) return { error: "품목을 1개 이상 입력해주세요." };

  const supabase = await createClient();
  const { data: requestId, error } = await supabase.rpc("create_purchase_request_with_items", {
    p_supplier_id: supplierId,
    p_request_date: requestDate || todayKstStr(),
    p_memo: memo || null,
    p_items: items,
  });

  if (error || !requestId) {
    return { error: `구매요청 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/purchase-requests");
  redirect(`/purchase-requests/${requestId}`);
}

export async function deletePurchaseRequest(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("purchase_requests").delete().eq("id", id).select("id");

  const deleteError = requireMutatedRow(result, "삭제에 실패했습니다");
  if (deleteError) return deleteError;

  revalidatePath("/purchase-requests");
  redirect("/purchase-requests");
}

// 제출(마감) — 결재선을 지정해 결재를 시작한다(submit_purchase_request RPC 내부
// 검증: 본인 작성 + draft 상태 + 품목 1개 이상).
export async function submitPurchaseRequest(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const approverIds = formData.getAll("approver_id").map(String).filter(Boolean);
  const referenceIds = formData.getAll("reference_id").map(String).filter(Boolean);

  if (!id) return { error: "잘못된 요청입니다." };
  if (approverIds.length === 0) {
    return { error: "결재선(승인자)을 1명 이상 지정해주세요." };
  }

  const supabase = await createClient();
  const { data: docId, error } = await supabase.rpc("submit_purchase_request", {
    p_id: id,
    p_approver_ids: approverIds,
    p_reference_ids: referenceIds,
  });

  if (error || !docId) {
    return { error: `제출에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/approvals");
  return { success: "제출했습니다. 결재 진행 상황은 전자결재 기안함에서도 확인할 수 있습니다." };
}

// 제출 회수 — 아직 아무도 결재하지 않은 경우에만 허용된다(RPC 내부 검증).
export async function recallPurchaseRequestSubmission(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("recall_purchase_request", { p_id: id });
  if (error) {
    return { error: `회수에 실패했습니다: ${error.message}` };
  }

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${id}`);
  revalidatePath("/approvals");
  return { success: "회수했습니다. 다시 작성할 수 있습니다." };
}

// 승인된 구매요청을 그대로 구매발주(purchase_orders)로 전환한다 — 품목을
// 다시 입력할 필요 없이 create_purchase_with_items(기존 매입 등록 RPC)에
// 그대로 넘긴다(quotes의 convertQuoteToSale과 동일한 패턴).
export async function convertPurchaseRequestToPurchaseOrder(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const requestId = String(formData.get("purchase_request_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  if (!requestId || !warehouseId) return { error: "창고를 선택해주세요." };

  const supabase = await createClient();

  const { data: request, error: requestError } = await supabase
    .from("purchase_requests")
    .select("id, supplier_id, memo, status, converted_purchase_order_id")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError || !request) return { error: "구매요청을 찾을 수 없습니다." };
  if (request.converted_purchase_order_id) return { error: "이미 구매발주로 전환된 요청입니다." };
  if (request.status !== "approved") return { error: "승인된 구매요청만 발주로 전환할 수 있습니다." };

  const { data: items, error: itemsError } = await supabase
    .from("purchase_request_items")
    .select("product_id, custom_name, spec, quantity, estimated_unit_price, remark")
    .eq("purchase_request_id", requestId);

  if (itemsError) return { error: `품목 조회에 실패했습니다: ${itemsError.message}` };
  if (!items || items.length === 0) return { error: "전환할 품목이 없습니다." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: purchaseOrderId, error: createError } = await supabase.rpc("create_purchase_with_items", {
    p_supplier_id: request.supplier_id,
    p_warehouse_id: warehouseId,
    p_purchase_date: new Date().toISOString().slice(0, 10),
    p_memo: request.memo ? `[구매요청전환] ${request.memo}` : "[구매요청전환]",
    p_created_by: user?.id ?? null,
    p_items: items.map((item) => ({
      productId: item.product_id,
      customName: item.custom_name,
      spec: item.spec,
      quantity: item.quantity,
      unitCost: item.estimated_unit_price,
      remark: item.remark,
      lotNumber: null,
    })),
  });

  if (createError || !purchaseOrderId) {
    return { error: `구매발주 전환에 실패했습니다: ${createError?.message ?? "알 수 없는 오류"}` };
  }

  const { error: linkError } = await supabase
    .from("purchase_requests")
    .update({ converted_purchase_order_id: purchaseOrderId })
    .eq("id", requestId);
  if (linkError) {
    console.error("구매요청 전환 링크 갱신 실패:", linkError.message);
  }

  revalidatePath("/purchase-requests");
  revalidatePath(`/purchase-requests/${requestId}`);
  redirect(`/purchases/${purchaseOrderId}`);
}
