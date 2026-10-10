import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { AccessWall } from "@/components/erp/access-wall";
import { TaxInvoiceForm } from "@/components/tax-invoice-form";
import { TaxInvoiceDetail } from "@/components/tax-invoice-detail";
import { cancelTaxInvoice } from "@/app/(dashboard)/sales/[id]/tax-invoice/actions";
import { todayKstStr } from "@/lib/kst-date";
import { canIssueTaxInvoice, isTaxExempt, defaultInvoiceTypeFromTaxType } from "@/lib/tax-evidence-type";

export default async function TaxInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();

  const [{ data: order }, { data: company }, { data: existing }, actor] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("id, created_by, tax_type, evidence_type, customers(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("company_profile")
      .select("name, business_number, representative_name, address, business_type, business_item, email")
      .maybeSingle(),
    supabase
      .from("tax_invoices")
      .select(
        "id, invoice_type, issue_date, supply_amount, tax_amount, total_amount, cash_amount, check_amount, note_amount, credit_amount, claim_type, remark, consignee_name, consignee_business_number, consignee_representative_name, tax_invoice_items(id, line_date, item_name, spec, quantity, unit_price, supply_amount, tax_amount, remark, sort_order)",
      )
      .eq("sales_order_id", id)
      // 원본(= 수정이 아닌 최초 발행분)만 — 수정세금계산서가 쌓이면
      // sales_order_id가 더는 유일하지 않아 is()로 원본만 골라낸다.
      .is("original_invoice_id", null)
      .maybeSingle(),
    getCurrentActor(supabase),
  ]);

  if (!order) notFound();

  const allowManage = canManage(order.created_by, actor.userId, actor.isAdmin);
  if (!allowManage) {
    return <AccessWall title="매출관리 > 세금계산서" message="본인이 등록한 매출 건에만 세금계산서를 발행할 수 있습니다." backHref={`/sales/${id}`} />;
  }

  // 이미 발행된 세금계산서가 있으면(existing) 과세구분/증빙유형이 나중에
  // 바뀌었더라도 기존 건 열람/관리는 그대로 허용한다 — 아래 차단은 "새로
  // 작성"하려는 경우에만 적용한다.
  if (!existing) {
    if (isTaxExempt(order.tax_type)) {
      return (
        <AccessWall
          title="매출관리 > 세금계산서"
          message="이 매출 건은 과세구분이 면세입니다. 면세 거래는 세금계산서가 아니라 계산서(부가세 없는 별도 문서)를 발행해야 하며, 계산서 발행 기능은 아직 없습니다. 매출 수정 화면에서 과세구분을 확인해주세요."
          backHref={`/sales/${id}`}
        />
      );
    }
    if (!canIssueTaxInvoice(order.evidence_type)) {
      return (
        <AccessWall
          title="매출관리 > 세금계산서"
          message={`이 매출 건은 증빙유형이 "${order.evidence_type}"로 이미 지정돼 있습니다. 해당 증빙이 세금계산서를 대신하므로 별도 발행이 필요 없습니다. 증빙유형을 바꾸려면 매출 수정 화면에서 수정해주세요.`}
          backHref={`/sales/${id}`}
        />
      );
    }
  }

  const [{ data: items }, { data: corrections }] = await Promise.all([
    existing
      ? Promise.resolve({ data: null })
      : supabase
          .from("sales_order_items")
          .select("quantity, unit_price, spec, custom_name, products(name)")
          .eq("sales_order_id", id)
          .order("created_at"),
    existing
      ? supabase
          .from("tax_invoices")
          .select(
            "id, issue_date, modification_reason, supply_amount, tax_amount, total_amount, remark, tax_invoice_items(id, line_date, item_name, spec, quantity, unit_price, supply_amount, tax_amount, remark, sort_order)",
          )
          .eq("original_invoice_id", existing.id)
          .order("issue_date")
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: `/sales/${id}` } }} />
      <div className="mb-1 erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">매출관리 &gt; 세금계산서</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <CloseButton href={`/sales/${id}`}>ESC 매출 상세로</CloseButton>
        </div>
      </div>

      {existing ? (
        <TaxInvoiceDetail invoice={existing} corrections={corrections ?? []} salesOrderId={id} cancelAction={cancelTaxInvoice} />
      ) : (
        <TaxInvoiceForm
          salesOrderId={id}
          today={todayKstStr()}
          defaultInvoiceType={defaultInvoiceTypeFromTaxType(order.tax_type)}
          supplier={{
            name: company?.name ?? null,
            businessNumber: company?.business_number ?? null,
            representativeName: company?.representative_name ?? null,
            address: company?.address ?? null,
            businessType: company?.business_type ?? null,
            businessItem: company?.business_item ?? null,
            email: company?.email ?? null,
          }}
          buyer={{
            name: order.customers?.name ?? null,
            businessNumber: order.customers?.business_number ?? null,
            representativeName: order.customers?.representative_name ?? null,
            address: order.customers?.address ?? null,
            businessType: order.customers?.business_type ?? null,
            businessItem: order.customers?.business_item ?? null,
            email: order.customers?.email ?? null,
          }}
          initialRows={(items ?? []).map((item) => ({
            itemName: item.products?.name ?? item.custom_name ?? "",
            spec: item.spec ?? "",
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
          }))}
        />
      )}
    </div>
  );
}
