import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { BulkTaxInvoiceForm, type BulkEligibleOrder } from "@/components/bulk-tax-invoice-form";
import { currentMonthRange } from "@/lib/xlsx-response";
import { todayKstStr } from "@/lib/kst-date";
import { isTaxExempt, canIssueTaxInvoice } from "@/lib/tax-evidence-type";

export default async function BulkTaxInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from: defaultFrom, to: defaultTo } = currentMonthRange();
  const { from: fromParam, to: toParam } = await searchParams;
  const from = fromParam || defaultFrom;
  const to = toParam || defaultTo;

  const supabase = await createClient();
  const actor = await getCurrentActor(supabase);

  // 세금계산서 발행은 본인이 등록한 매출 건만 할 수 있는 규칙
  // (can-manage-order.ts)이라, 목록 자체도 그 기준으로 미리 좁혀서
  // 보여준다 — 선택은 가능한데 제출하면 "본인 건이 아닙니다"로 전부
  // 튕기는 혼란을 막는다.
  let query = supabase
    .from("sales_orders")
    .select("id, doc_no, order_date, tax_type, evidence_type, created_by, customers(name)")
    .gte("order_date", from)
    .lte("order_date", to)
    .order("order_date", { ascending: false });
  if (!actor.isAdmin) query = query.eq("created_by", actor.userId ?? "");
  const { data: orders } = await query;

  const candidateIds = (orders ?? []).map((o) => o.id);
  const { data: issuedRows } = candidateIds.length
    ? await supabase
        .from("tax_invoices")
        .select("sales_order_id")
        .in("sales_order_id", candidateIds)
        .is("original_invoice_id", null)
    : { data: [] as { sales_order_id: string }[] };
  const issuedSet = new Set((issuedRows ?? []).map((r) => r.sales_order_id));

  const eligibleOrders = (orders ?? []).filter(
    (o) => !issuedSet.has(o.id) && !isTaxExempt(o.tax_type) && canIssueTaxInvoice(o.evidence_type),
  );
  const excludedCount = (orders ?? []).length - eligibleOrders.length;

  const eligibleIds = eligibleOrders.map((o) => o.id);
  const { data: itemRows } = eligibleIds.length
    ? await supabase.from("sales_order_items").select("sales_order_id, quantity, unit_price").in("sales_order_id", eligibleIds)
    : { data: [] as { sales_order_id: string; quantity: number; unit_price: number }[] };
  const supplyByOrder = new Map<string, number>();
  for (const item of itemRows ?? []) {
    const prev = supplyByOrder.get(item.sales_order_id) ?? 0;
    supplyByOrder.set(item.sales_order_id, prev + Number(item.quantity) * Number(item.unit_price));
  }

  const bulkOrders: BulkEligibleOrder[] = eligibleOrders.map((o) => ({
    id: o.id,
    docNo: o.doc_no ?? null,
    date: o.order_date,
    customerName: o.customers?.name ?? null,
    supplyAmount: supplyByOrder.get(o.id) ?? 0,
  }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/sales" } }} />
      <ListPageHeader title="매출관리 > 세금계산서 일괄 작성" />

      <PageGuide>
        기간 내 매출 건 중 아직 세금계산서가 없고 발행 가능한(면세/다른 증빙유형 아님) 건만 모아서, 선택한 건을
        한 번에 세금계산서로 작성합니다. 각 건은 품목 수량×단가로 공급가액/세액을 자동 계산하며, 결제수단은
        전부 0(추후 거래처에서 수금 처리)으로, 종류는 과세구분에 따라 일반/영세율로 자동 지정됩니다. 위수탁
        거래나 수탁자 정보가 필요한 건은 매출 상세의 개별 세금계산서 작성 화면을 이용해주세요.
      </PageGuide>

      <form method="get" className="erp-search">
        <div className="erp-field">
          <label htmlFor="bulk-from">시작일</label>
          <input id="bulk-from" type="date" name="from" defaultValue={from} className="erp-input" />
        </div>
        <div className="erp-field">
          <label htmlFor="bulk-to">종료일</label>
          <input id="bulk-to" type="date" name="to" defaultValue={to} className="erp-input" />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          조회
        </button>
      </form>

      {excludedCount > 0 && (
        <p className="text-xs" style={{ color: "var(--erp-text-muted)", marginTop: 4 }}>
          이미 발행됐거나 면세/다른 증빙유형이라 제외된 건 {excludedCount}건 (목록에는 표시하지 않음)
        </p>
      )}

      <div style={{ marginTop: 10 }}>
        <BulkTaxInvoiceForm orders={bulkOrders} today={todayKstStr()} />
      </div>
    </div>
  );
}
