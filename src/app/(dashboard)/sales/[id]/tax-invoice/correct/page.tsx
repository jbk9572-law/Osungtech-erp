import { notFound } from "next/navigation";
import { isUuid } from "@/lib/is-uuid";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { AccessWall } from "@/components/erp/access-wall";
import { TaxInvoiceCorrectionForm } from "@/components/tax-invoice-correction-form";
import { todayKstStr } from "@/lib/kst-date";

export default async function TaxInvoiceCorrectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();

  const [{ data: order }, { data: original }, actor] = await Promise.all([
    supabase.from("sales_orders").select("id, created_by").eq("id", id).maybeSingle(),
    supabase
      .from("tax_invoices")
      .select("id, issue_date, tax_invoice_items(item_name, spec, quantity, unit_price)")
      .eq("sales_order_id", id)
      .is("original_invoice_id", null)
      .maybeSingle(),
    getCurrentActor(supabase),
  ]);

  if (!order) notFound();
  // 원본 세금계산서가 없으면 수정할 대상 자체가 없다 — 작성 화면으로.
  if (!original) notFound();

  const allowManage = canManage(order.created_by, actor.userId, actor.isAdmin);
  if (!allowManage) {
    return <AccessWall title="매출관리 > 수정세금계산서" message="본인이 등록한 매출 건에만 수정세금계산서를 발행할 수 있습니다." backHref={`/sales/${id}/tax-invoice`} />;
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: `/sales/${id}/tax-invoice` } }} />
      <div className="mb-1 erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">매출관리 &gt; 수정세금계산서</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <CloseButton href={`/sales/${id}/tax-invoice`}>ESC 세금계산서로</CloseButton>
        </div>
      </div>

      <TaxInvoiceCorrectionForm
        salesOrderId={id}
        originalInvoiceId={original.id}
        today={todayKstStr()}
        originalIssueDate={original.issue_date}
        originalItems={(original.tax_invoice_items ?? []).map((item) => ({
          itemName: item.item_name,
          spec: item.spec ?? "",
          quantity: item.quantity ?? 0,
          unitPrice: item.unit_price ?? 0,
        }))}
      />
    </div>
  );
}
