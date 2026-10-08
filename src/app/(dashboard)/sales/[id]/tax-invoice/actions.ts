"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { canManageOrder } from "@/lib/can-manage-order";
import type { FormState } from "@/components/form-message";

type ItemInput = {
  lineDate: string | null;
  itemName: string;
  spec: string | null;
  quantity: number;
  unitPrice: number;
  supplyAmount: number;
  taxAmount: number;
  remark: string | null;
};

const INVOICE_TYPES = ["general", "zero_rate", "consignment", "consignment_zero_rate"] as const;
const MODIFICATION_REASONS = [
  "error_correction",
  "duplicate_issued",
  "supply_amount_change",
  "contract_cancelled",
  "goods_returned",
  "export_lc_after",
] as const;

// 세금계산서 발행 — 매출 건 하나당 "원본" 세금계산서는 최대 1장
// (tax_invoices.original_invoice_id가 null인 행에 부분 유니크 인덱스).
// 아직 수정세금계산서가 없는 원본이면 지우고 새로 만든다(재발행/수정 —
// new-quote-form.tsx 등 다른 문서 작성 폼과 같은 "전체 교체" 방식). 이미
// 수정세금계산서가 딸려 있으면 원본을 통째로 지울 수 없으므로 막고,
// createTaxInvoiceCorrection(수정세금계산서 발행)을 쓰게 안내한다.
export async function createTaxInvoice(_prevState: FormState, formData: FormData): Promise<FormState> {
  const salesOrderId = String(formData.get("sales_order_id") ?? "");
  const issueDate = String(formData.get("issue_date") ?? "");
  const invoiceType = String(formData.get("invoice_type") ?? "general");
  const claimType = String(formData.get("claim_type") ?? "claim");
  const remark = String(formData.get("remark") ?? "").trim() || null;
  const supplyAmount = Number(formData.get("supply_amount") ?? 0);
  const taxAmount = Number(formData.get("tax_amount") ?? 0);
  const totalAmount = Number(formData.get("total_amount") ?? 0);
  const cashAmount = Number(formData.get("cash_amount") ?? 0);
  const checkAmount = Number(formData.get("check_amount") ?? 0);
  const noteAmount = Number(formData.get("note_amount") ?? 0);
  const creditAmount = Number(formData.get("credit_amount") ?? 0);
  const isConsignment = invoiceType === "consignment" || invoiceType === "consignment_zero_rate";
  const consigneeName = isConsignment ? String(formData.get("consignee_name") ?? "").trim() || null : null;
  const consigneeBusinessNumber = isConsignment ? String(formData.get("consignee_business_number") ?? "").trim() || null : null;
  const consigneeRepresentativeName = isConsignment ? String(formData.get("consignee_representative_name") ?? "").trim() || null : null;

  if (!salesOrderId || !issueDate) {
    return { error: "작성일자를 입력해주세요." };
  }
  if (!(INVOICE_TYPES as readonly string[]).includes(invoiceType)) {
    return { error: "잘못된 요청입니다." };
  }
  if (claimType !== "claim" && claimType !== "receipt") {
    return { error: "잘못된 요청입니다." };
  }
  if (isConsignment && (!consigneeName || !consigneeBusinessNumber || !consigneeRepresentativeName)) {
    return { error: "위수탁 거래는 수탁자 상호/등록번호/성명을 모두 입력해주세요." };
  }

  let items: ItemInput[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "품목 정보가 올바르지 않습니다." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "품목을 1개 이상 입력해주세요." };
  }

  const supabase = await createClient();
  if (!(await canManageOrder(supabase, "sales_orders", salesOrderId))) {
    return { error: "본인이 등록한 매출 건에만 세금계산서를 발행할 수 있습니다." };
  }

  const { data: order } = await supabase
    .from("sales_orders")
    .select("customer_id")
    .eq("id", salesOrderId)
    .maybeSingle();
  if (!order) {
    return { error: "매출 건을 찾을 수 없습니다." };
  }

  const user = await getUser();

  // 재발행이면 기존 원본을 지우고 새로 만든다(위 주석 참고) — 단, 이미 그
  // 원본에 딸린 수정세금계산서가 있으면 통째로 지울 수 없으니 막는다.
  const { data: existingOriginal } = await supabase
    .from("tax_invoices")
    .select("id")
    .eq("sales_order_id", salesOrderId)
    .is("original_invoice_id", null)
    .maybeSingle();

  if (existingOriginal) {
    const { count: correctionCount } = await supabase
      .from("tax_invoices")
      .select("id", { count: "exact", head: true })
      .eq("original_invoice_id", existingOriginal.id);
    if (correctionCount && correctionCount > 0) {
      return { error: "이미 수정세금계산서가 발행된 건입니다. 원본을 다시 고칠 수는 없고, 수정세금계산서를 추가로 발행해주세요." };
    }
    const { error: deleteExistingError } = await supabase.from("tax_invoices").delete().eq("id", existingOriginal.id);
    if (deleteExistingError) {
      return { error: `기존 세금계산서 삭제에 실패했습니다: ${deleteExistingError.message}` };
    }
  }

  const { data: invoice, error: insertError } = await supabase
    .from("tax_invoices")
    .insert({
      sales_order_id: salesOrderId,
      customer_id: order.customer_id,
      invoice_type: invoiceType as (typeof INVOICE_TYPES)[number],
      issue_date: issueDate,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      cash_amount: cashAmount,
      check_amount: checkAmount,
      note_amount: noteAmount,
      credit_amount: creditAmount,
      claim_type: claimType as "claim" | "receipt",
      remark,
      consignee_name: consigneeName,
      consignee_business_number: consigneeBusinessNumber,
      consignee_representative_name: consigneeRepresentativeName,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !invoice) {
    return { error: `발행에 실패했습니다${insertError ? `: ${insertError.message}` : ""}` };
  }

  const { error: itemsError } = await supabase.from("tax_invoice_items").insert(
    items.map((item, i) => ({
      tax_invoice_id: invoice.id,
      line_date: item.lineDate,
      item_name: item.itemName,
      spec: item.spec,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      supply_amount: item.supplyAmount,
      tax_amount: item.taxAmount,
      remark: item.remark,
      sort_order: i,
    })),
  );

  if (itemsError) {
    // 품목 저장이 실패했으면 방금 만든 헤더만 남는 반쪽짜리 레코드가
    // 되므로 같이 되돌린다 — 이 되돌리기 자체가 실패해도(드문 경우)
    // 사용자에게는 원래 에러(품목 저장 실패)를 그대로 보여준다.
    const { error: rollbackError } = await supabase.from("tax_invoices").delete().eq("id", invoice.id);
    if (rollbackError) {
      console.error("세금계산서 헤더 롤백 실패:", rollbackError);
    }
    return { error: `품목 저장에 실패했습니다: ${itemsError.message}` };
  }

  // 목록 화면(sales/page.tsx)이 여전히 sales_orders.invoice_status만
  // 보고 "계산서 발행완료" 배지를 그리므로, 상세 데이터와 어긋나지 않게
  // 같이 갱신한다. 세금계산서 자체는 이미 저장됐으니, 이 갱신만 실패해도
  // 사용자에게 에러로 보여주지 않고 콘솔에만 남긴다(목록 배지만 잠시
  // 어긋날 뿐 데이터 유실은 아니다).
  const { error: syncError } = await supabase
    .from("sales_orders")
    .update({ invoice_status: "issued", invoice_issued_at: issueDate, invoice_provider: "manual" })
    .eq("id", salesOrderId);
  if (syncError) {
    console.error("sales_orders.invoice_status 동기화 실패:", syncError);
  }

  revalidatePath(`/sales/${salesOrderId}`);
  revalidatePath("/sales");
  redirect(`/sales/${salesOrderId}`);
}

export async function cancelTaxInvoice(_prevState: FormState, formData: FormData): Promise<FormState> {
  const salesOrderId = String(formData.get("sales_order_id") ?? "");
  if (!salesOrderId) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  if (!(await canManageOrder(supabase, "sales_orders", salesOrderId))) {
    return { error: "본인이 등록한 매출 건에만 세금계산서 상태를 기록할 수 있습니다." };
  }

  // 원본에 수정세금계산서가 딸려 있으면 전부 같이 지운다(tax_invoices의
  // original_invoice_id FK가 on delete cascade라 원본만 지워도 수정분은
  // DB에서 자동으로 같이 지워지지만, 수정 이력까지 통째로 날리는 거라
  // "미발행으로 되돌리기"는 수정 이력이 없을 때만 허용한다).
  const { data: existingOriginal } = await supabase
    .from("tax_invoices")
    .select("id")
    .eq("sales_order_id", salesOrderId)
    .is("original_invoice_id", null)
    .maybeSingle();
  if (existingOriginal) {
    const { count: correctionCount } = await supabase
      .from("tax_invoices")
      .select("id", { count: "exact", head: true })
      .eq("original_invoice_id", existingOriginal.id);
    if (correctionCount && correctionCount > 0) {
      return { error: "수정세금계산서가 발행된 건은 미발행으로 되돌릴 수 없습니다." };
    }
  }

  const { error: deleteError } = await supabase.from("tax_invoices").delete().eq("sales_order_id", salesOrderId);
  if (deleteError) {
    return { error: `처리에 실패했습니다: ${deleteError.message}` };
  }

  const { error } = await supabase
    .from("sales_orders")
    .update({ invoice_status: "not_issued", invoice_number: null, invoice_issued_at: null })
    .eq("id", salesOrderId);

  if (error) {
    return { error: `처리에 실패했습니다: ${error.message}` };
  }

  revalidatePath(`/sales/${salesOrderId}`);
  revalidatePath("/sales");
  return { success: "미발행 상태로 되돌렸습니다." };
}

// 수정세금계산서 발행 — 이미 발행된 원본(또는 다른 수정분)을 가리키는 새
// 행을 추가한다(원본은 그대로 두고 쌓아가는 방식 — 국세청에 실제로 신고된
// 기록을 수정 없이 보존해야 하므로 원본 삭제가 아니라 별도 행으로 쌓는다).
export async function createTaxInvoiceCorrection(_prevState: FormState, formData: FormData): Promise<FormState> {
  const salesOrderId = String(formData.get("sales_order_id") ?? "");
  const originalInvoiceId = String(formData.get("original_invoice_id") ?? "");
  const issueDate = String(formData.get("issue_date") ?? "");
  const modificationReason = String(formData.get("modification_reason") ?? "");
  const remark = String(formData.get("remark") ?? "").trim() || null;
  const supplyAmount = Number(formData.get("supply_amount") ?? 0);
  const taxAmount = Number(formData.get("tax_amount") ?? 0);
  const totalAmount = Number(formData.get("total_amount") ?? 0);

  if (!salesOrderId || !originalInvoiceId || !issueDate) {
    return { error: "잘못된 요청입니다." };
  }
  if (!(MODIFICATION_REASONS as readonly string[]).includes(modificationReason)) {
    return { error: "수정 사유를 선택해주세요." };
  }

  let items: ItemInput[];
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "품목 정보가 올바르지 않습니다." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "품목을 1개 이상 입력해주세요." };
  }

  const supabase = await createClient();
  if (!(await canManageOrder(supabase, "sales_orders", salesOrderId))) {
    return { error: "본인이 등록한 매출 건에만 수정세금계산서를 발행할 수 있습니다." };
  }

  const { data: original } = await supabase
    .from("tax_invoices")
    .select("id, customer_id, invoice_type, claim_type")
    .eq("id", originalInvoiceId)
    .eq("sales_order_id", salesOrderId)
    .maybeSingle();
  if (!original) {
    return { error: "원본 세금계산서를 찾을 수 없습니다." };
  }

  const user = await getUser();

  const { data: correction, error: insertError } = await supabase
    .from("tax_invoices")
    .insert({
      sales_order_id: salesOrderId,
      customer_id: original.customer_id,
      invoice_type: original.invoice_type,
      issue_date: issueDate,
      supply_amount: supplyAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      claim_type: original.claim_type,
      remark,
      original_invoice_id: originalInvoiceId,
      modification_reason: modificationReason as (typeof MODIFICATION_REASONS)[number],
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (insertError || !correction) {
    return { error: `수정세금계산서 발행에 실패했습니다${insertError ? `: ${insertError.message}` : ""}` };
  }

  const { error: itemsError } = await supabase.from("tax_invoice_items").insert(
    items.map((item, i) => ({
      tax_invoice_id: correction.id,
      line_date: item.lineDate,
      item_name: item.itemName,
      spec: item.spec,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      supply_amount: item.supplyAmount,
      tax_amount: item.taxAmount,
      remark: item.remark,
      sort_order: i,
    })),
  );

  if (itemsError) {
    const { error: rollbackError } = await supabase.from("tax_invoices").delete().eq("id", correction.id);
    if (rollbackError) {
      console.error("수정세금계산서 헤더 롤백 실패:", rollbackError);
    }
    return { error: `품목 저장에 실패했습니다: ${itemsError.message}` };
  }

  revalidatePath(`/sales/${salesOrderId}`);
  revalidatePath(`/sales/${salesOrderId}/tax-invoice`);
  revalidatePath("/sales");
  redirect(`/sales/${salesOrderId}/tax-invoice`);
}
