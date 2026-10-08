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

export default async function TaxInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();

  const [{ data: order }, { data: company }, { data: existing }, actor] = await Promise.all([
    supabase
      .from("sales_orders")
      .select("id, created_by, customers(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("company_profile")
      .select("name, business_number, representative_name, address, business_type, business_item, email")
      .maybeSingle(),
    supabase
      .from("tax_invoices")
      .select(
        "id, invoice_type, issue_date, supply_amount, tax_amount, total_amount, cash_amount, check_amount, note_amount, credit_amount, claim_type, remark, tax_invoice_items(id, line_date, item_name, spec, quantity, unit_price, supply_amount, tax_amount, remark, sort_order)",
      )
      .eq("sales_order_id", id)
      .maybeSingle(),
    getCurrentActor(supabase),
  ]);

  if (!order) notFound();

  const allowManage = canManage(order.created_by, actor.userId, actor.isAdmin);
  if (!allowManage) {
    return <AccessWall title="매출관리 > 세금계산서" message="본인이 등록한 매출 건에만 세금계산서를 발행할 수 있습니다." />;
  }

  const { data: items } = existing
    ? { data: null }
    : await supabase
        .from("sales_order_items")
        .select("quantity, unit_price, spec, custom_name, products(name)")
        .eq("sales_order_id", id)
        .order("created_at");

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
        <TaxInvoiceDetail invoice={existing} salesOrderId={id} cancelAction={cancelTaxInvoice} />
      ) : (
        <TaxInvoiceForm
          salesOrderId={id}
          today={todayKstStr()}
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
