"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { calcVat } from "@/lib/tax";
import { isTaxExempt, canIssueTaxInvoice, defaultInvoiceTypeFromTaxType } from "@/lib/tax-evidence-type";

export type BulkTaxInvoiceState =
  | {
      error?: string;
      success?: string;
      created?: number;
      skipped?: { docNo: number | null; customerName: string | null; reason: string }[];
    }
  | undefined;

// /sales/[id]/tax-invoice/actions.ts의 createTaxInvoice()를 매출 건 하나씩
// 들어가지 않고 여러 건을 한 번에 돌리는 버전 — 품목/금액 계산 로직은
// 단건 발행 화면(TaxInvoiceForm)이 initialRows를 만드는 방식과 똑같이
// 맞춘다(품목별 공급가액=수량×단가, 세액=calcVat). 위수탁 거래는 수탁자
// 정보를 건별로 입력받아야 해서 일괄 발행 대상에서 제외하고(발행 가능
// 여부 판단에서 걸러짐 없이 그냥 invoice_type을 일반/영세율로만 결정),
// 현금/수표/어음/외상미수금은 전부 0으로 발행한다(건별 결제수단은 나중에
// 거래처에서 실제 수금 처리할 때 반영 — 발행 자체를 막을 이유는 아니다).
export async function bulkCreateTaxInvoices(
  _prevState: BulkTaxInvoiceState,
  formData: FormData,
): Promise<BulkTaxInvoiceState> {
  const issueDate = String(formData.get("issue_date") ?? "");
  const claimType = String(formData.get("claim_type") ?? "claim");

  let salesOrderIds: string[];
  try {
    salesOrderIds = JSON.parse(String(formData.get("sales_order_ids") ?? "[]"));
  } catch {
    return { error: "잘못된 요청입니다." };
  }

  if (!issueDate) return { error: "작성일자를 입력해주세요." };
  if (claimType !== "claim" && claimType !== "receipt") return { error: "잘못된 요청입니다." };
  if (!Array.isArray(salesOrderIds) || salesOrderIds.length === 0) {
    return { error: "세금계산서를 발행할 매출 건을 1개 이상 선택해주세요." };
  }

  const supabase = await createClient();
  const [actor, user] = await Promise.all([getCurrentActor(supabase), getUser()]);

  const { data: orders } = await supabase
    .from("sales_orders")
    .select("id, doc_no, created_by, customer_id, tax_type, evidence_type, customers(name)")
    .in("id", salesOrderIds);

  const skipped: { docNo: number | null; customerName: string | null; reason: string }[] = [];
  let created = 0;

  for (const orderId of salesOrderIds) {
    const order = orders?.find((o) => o.id === orderId);
    if (!order) {
      skipped.push({ docNo: null, customerName: null, reason: "매출 건을 찾을 수 없습니다." });
      continue;
    }
    const label = { docNo: order.doc_no ?? null, customerName: order.customers?.name ?? null };

    if (!canManage(order.created_by, actor.userId, actor.isAdmin)) {
      skipped.push({ ...label, reason: "본인이 등록한 건이 아닙니다." });
      continue;
    }
    if (isTaxExempt(order.tax_type)) {
      skipped.push({ ...label, reason: "면세 거래입니다." });
      continue;
    }
    if (!canIssueTaxInvoice(order.evidence_type)) {
      skipped.push({ ...label, reason: `증빙유형이 "${order.evidence_type}"입니다.` });
      continue;
    }

    const { data: existing } = await supabase
      .from("tax_invoices")
      .select("id")
      .eq("sales_order_id", orderId)
      .is("original_invoice_id", null)
      .maybeSingle();
    if (existing) {
      skipped.push({ ...label, reason: "이미 세금계산서가 발행된 건입니다." });
      continue;
    }

    const { data: items } = await supabase
      .from("sales_order_items")
      .select("quantity, unit_price, spec, custom_name, products(name)")
      .eq("sales_order_id", orderId)
      .order("created_at");
    const rows = (items ?? []).filter((it) => Number(it.quantity) > 0);
    if (rows.length === 0) {
      skipped.push({ ...label, reason: "품목이 없습니다." });
      continue;
    }

    const lineItems = rows.map((it) => {
      const supplyAmount = Number(it.quantity) * Number(it.unit_price);
      return {
        itemName: it.products?.name ?? it.custom_name ?? "",
        spec: it.spec,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        supplyAmount,
        taxAmount: calcVat(supplyAmount),
      };
    });
    const totalSupply = lineItems.reduce((sum, r) => sum + r.supplyAmount, 0);
    const totalTax = lineItems.reduce((sum, r) => sum + r.taxAmount, 0);

    const { data: invoice, error: insertError } = await supabase
      .from("tax_invoices")
      .insert({
        sales_order_id: orderId,
        customer_id: order.customer_id,
        invoice_type: defaultInvoiceTypeFromTaxType(order.tax_type),
        issue_date: issueDate,
        supply_amount: totalSupply,
        tax_amount: totalTax,
        total_amount: totalSupply + totalTax,
        cash_amount: 0,
        check_amount: 0,
        note_amount: 0,
        credit_amount: 0,
        claim_type: claimType as "claim" | "receipt",
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (insertError || !invoice) {
      skipped.push({ ...label, reason: `발행 실패: ${insertError?.message ?? "알 수 없는 오류"}` });
      continue;
    }

    const { error: itemsError } = await supabase.from("tax_invoice_items").insert(
      lineItems.map((item, i) => ({
        tax_invoice_id: invoice.id,
        line_date: issueDate,
        item_name: item.itemName,
        spec: item.spec,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        supply_amount: item.supplyAmount,
        tax_amount: item.taxAmount,
        remark: null,
        sort_order: i,
      })),
    );

    if (itemsError) {
      const { error: rollbackError } = await supabase.from("tax_invoices").delete().eq("id", invoice.id);
      if (rollbackError) console.error("세금계산서 헤더 롤백 실패:", rollbackError);
      skipped.push({ ...label, reason: `품목 저장 실패: ${itemsError.message}` });
      continue;
    }

    const { error: syncError } = await supabase
      .from("sales_orders")
      .update({ invoice_status: "issued", invoice_issued_at: issueDate, invoice_provider: "manual" })
      .eq("id", orderId);
    if (syncError) console.error("sales_orders.invoice_status 동기화 실패:", syncError);

    const { error: invoiceUsageError } = await supabase.rpc("increment_tenant_invoice_usage");
    if (invoiceUsageError) console.error("계산서 쿼터 사용량 갱신 실패:", invoiceUsageError.message);

    created++;
  }

  revalidatePath("/sales");
  revalidatePath("/sales/tax-invoices/bulk-create");

  if (created === 0) {
    return { error: "발행된 세금계산서가 없습니다.", skipped };
  }
  return {
    success: `${created}건 발행 완료${skipped.length > 0 ? ` (${skipped.length}건 제외)` : ""}`,
    created,
    skipped,
  };
}
