"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import { todayKstStr } from "@/lib/kst-date";
import type { FormState } from "@/components/form-message";

type QuoteRequestItemInput = {
  productId: string;
  spec: string | null;
  quantity: number;
  remark: string | null;
};

function parseItems(raw: string): QuoteRequestItemInput[] {
  try {
    const items = JSON.parse(raw) as QuoteRequestItemInput[];
    return Array.isArray(items) ? items.filter((i) => i.productId && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

export async function createPurchaseQuoteRequest(_prevState: FormState, formData: FormData): Promise<FormState> {
  const supplierIds = formData.getAll("supplier_id").map(String).filter(Boolean);
  const requestDate = String(formData.get("request_date") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (supplierIds.length === 0) return { error: "견적을 받을 공급처를 1곳 이상 선택해주세요." };
  if (items.length === 0) return { error: "품목을 1개 이상 입력해주세요." };

  const supabase = await createClient();
  const { data: requestId, error } = await supabase.rpc("create_purchase_quote_request_with_items", {
    p_supplier_ids: supplierIds,
    p_request_date: requestDate || todayKstStr(),
    p_memo: memo || null,
    p_items: items,
  });

  if (error || !requestId) {
    return { error: `견적요청 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/purchase-quote-requests");
  redirect(`/purchase-quote-requests/${requestId}`);
}

// 한 공급처가 준 견적가를 한 번에 저장한다 — set_purchase_quote_prices RPC가
// "지우고 다시 넣기"로 처리하므로 여기서는 폼 값을 그대로 넘기기만 한다.
export async function savePurchaseQuotePrices(_prevState: FormState, formData: FormData): Promise<FormState> {
  const requestId = String(formData.get("purchase_quote_request_id") ?? "");
  const supplierId = String(formData.get("supplier_id") ?? "");
  const itemIds = formData.getAll("item_id").map(String);
  const unitPrices = formData.getAll("unit_price").map(String);

  if (!requestId || !supplierId) return { error: "잘못된 요청입니다." };

  const items = itemIds.map((itemId, i) => ({
    itemId,
    unitPrice: Number(unitPrices[i] ?? 0),
  }));

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_purchase_quote_prices", {
    p_purchase_quote_request_id: requestId,
    p_supplier_id: supplierId,
    p_items: items,
  });

  if (error) return { error: `견적가 저장에 실패했습니다: ${error.message}` };

  revalidatePath(`/purchase-quote-requests/${requestId}`);
  return { success: "견적가를 저장했습니다." };
}

// 공급처를 확정하고 구매요청으로 전환한다(convert_purchase_quote_request
// RPC가 단가 매핑까지 처리) — quotes의 convertQuoteToSale과 동일한
// "다시 입력할 필요 없이 그대로 넘긴다" 원칙.
export async function convertPurchaseQuoteRequest(_prevState: FormState, formData: FormData): Promise<FormState> {
  const requestId = String(formData.get("purchase_quote_request_id") ?? "");
  const supplierId = String(formData.get("supplier_id") ?? "");
  if (!requestId || !supplierId) return { error: "공급처를 선택해주세요." };

  const supabase = await createClient();
  const { data: purchaseRequestId, error } = await supabase.rpc("convert_purchase_quote_request", {
    p_id: requestId,
    p_supplier_id: supplierId,
  });

  if (error || !purchaseRequestId) {
    return { error: `구매요청 전환에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/purchase-quote-requests");
  revalidatePath(`/purchase-quote-requests/${requestId}`);
  redirect(`/purchase-requests/${purchaseRequestId}`);
}

export async function deletePurchaseQuoteRequest(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("purchase_quote_requests").delete().eq("id", id).select("id");

  const deleteError = requireMutatedRow(result, "삭제에 실패했습니다");
  if (deleteError) return deleteError;

  revalidatePath("/purchase-quote-requests");
  redirect("/purchase-quote-requests");
}
