"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMutatedRow } from "@/lib/require-mutated-row";
import { todayKstStr } from "@/lib/kst-date";
import type { FormState } from "@/components/form-message";

const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "expired"] as const;
type QuoteStatus = (typeof QUOTE_STATUSES)[number];

type QuoteItemInput = {
  productId: string;
  spec: string | null;
  quantity: number;
  unitPrice: number;
  remark: string | null;
};

function parseItems(raw: string): QuoteItemInput[] {
  try {
    const items = JSON.parse(raw) as QuoteItemInput[];
    return Array.isArray(items) ? items.filter((i) => i.productId && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

export async function createQuote(_prevState: FormState, formData: FormData): Promise<FormState> {
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const quoteDate = String(formData.get("quote_date") ?? "").trim();
  const validUntil = String(formData.get("valid_until") ?? "").trim();
  const memo = String(formData.get("memo") ?? "").trim();
  const items = parseItems(String(formData.get("items") ?? "[]"));

  if (!customerId) return { error: "거래처를 선택해주세요." };
  if (items.length === 0) return { error: "품목을 1개 이상 입력해주세요." };

  const supabase = await createClient();
  const { data: quoteId, error } = await supabase.rpc("create_quote_with_items", {
    p_customer_id: customerId,
    p_quote_date: quoteDate || todayKstStr(),
    p_valid_until: validUntil || null,
    p_memo: memo || null,
    p_items: items,
  });

  if (error || !quoteId) {
    return { error: `견적서 등록에 실패했습니다: ${error?.message ?? "알 수 없는 오류"}` };
  }

  revalidatePath("/quotes");
  redirect(`/quotes/${quoteId}`);
}

export async function updateQuoteStatus(formData: FormData): Promise<{ error: string } | undefined> {
  const id = String(formData.get("id") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  if (!id || !QUOTE_STATUSES.includes(statusRaw as QuoteStatus)) return { error: "잘못된 요청입니다." };
  const status = statusRaw as QuoteStatus;

  const supabase = await createClient();
  const result = await supabase.from("quotes").update({ status }).eq("id", id).select("id");

  const updateError = requireMutatedRow(result, "상태 변경에 실패했습니다");
  if (updateError) return updateError;

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
}

export async function deleteQuote(_prevState: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const result = await supabase.from("quotes").delete().eq("id", id).select("id");

  const deleteError = requireMutatedRow(result, "삭제에 실패했습니다");
  if (deleteError) return deleteError;

  revalidatePath("/quotes");
  redirect("/quotes");
}

// 견적을 그대로 매출(sales_orders)로 전환한다 — 품목을 다시 입력할 필요
// 없이 create_sale_with_items(기존 매출 등록 RPC)에 견적 품목을 그대로
// 넘긴다. 성공하면 quotes.converted_sales_order_id에 링크를 남기고
// status를 'accepted'로 바꾼다.
export async function convertQuoteToSale(_prevState: FormState, formData: FormData): Promise<FormState> {
  const quoteId = String(formData.get("quote_id") ?? "");
  const warehouseId = String(formData.get("warehouse_id") ?? "");
  if (!quoteId || !warehouseId) return { error: "창고를 선택해주세요." };

  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, customer_id, memo, converted_sales_order_id, created_by")
    .eq("id", quoteId)
    .maybeSingle();

  if (quoteError || !quote) return { error: "견적서를 찾을 수 없습니다." };
  if (quote.converted_sales_order_id) return { error: "이미 매출로 전환된 견적서입니다." };

  // 아래에서 create_sale_with_items RPC로 매출 전표를 먼저 만든 뒤 이
  // 견적서에 링크를 남기는 순서라, 작성자 확인 없이 진행하면 본인 것이
  // 아닌 견적서로도 매출 전표는 만들어지는데 정작 견적서 쪽 링크 갱신만
  // RLS(quotes_update_owner_or_admin)에 막혀 조용히 실패하는 반쪽짜리
  // 상태가 될 수 있다 — 맨 앞에서 명시적으로 막는다.
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  const { data: actorProfile } = actor
    ? await supabase.from("profiles").select("role").eq("id", actor.id).maybeSingle()
    : { data: null };
  const isActorAdmin = actorProfile?.role === "admin";
  if (quote.created_by !== actor?.id && !isActorAdmin) {
    return { error: "본인이 작성한 견적서만 매출로 전환할 수 있습니다." };
  }

  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("product_id, custom_name, spec, quantity, unit_price, remark")
    .eq("quote_id", quoteId);

  if (itemsError) return { error: `품목 조회에 실패했습니다: ${itemsError.message}` };
  if (!items || items.length === 0) return { error: "전환할 품목이 없습니다." };

  const { data: salesOrderId, error: createError } = await supabase.rpc("create_sale_with_items", {
    p_customer_id: quote.customer_id,
    p_warehouse_id: warehouseId,
    p_order_date: new Date().toISOString().slice(0, 10),
    p_memo: quote.memo ? `[견적전환] ${quote.memo}` : "[견적전환]",
    p_created_by: actor?.id ?? null,
    p_items: items.map((item) => ({
      productId: item.product_id,
      customName: item.custom_name,
      spec: item.spec,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      remark: item.remark,
      lotNumber: null,
    })),
  });

  if (createError || !salesOrderId) {
    return { error: `매출 전환에 실패했습니다: ${createError?.message ?? "알 수 없는 오류"}` };
  }

  const { error: linkError } = await supabase
    .from("quotes")
    .update({ status: "accepted", converted_sales_order_id: salesOrderId })
    .eq("id", quoteId);
  if (linkError) {
    console.error("견적 전환 링크 갱신 실패:", linkError.message);
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  redirect(`/sales/${salesOrderId}`);
}
