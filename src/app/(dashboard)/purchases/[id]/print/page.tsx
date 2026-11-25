import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoicePrintView } from "@/components/invoice/InvoicePrintView";
import type { InvoiceCopies, InvoiceLayout } from "@/components/invoice/InvoicePage";
import { toInvoiceParty, type InvoiceForm, type InvoiceItem } from "@/components/invoice/types";
import { formatPaperCalcSizeLines, mergePaperCalcInputItems } from "@/modules/paper-calc/public";
import { PAPER_STOCK_SKU } from "@/modules/paper-calc/public";
import { getSupplierBalance } from "@/lib/ar-ap";
import { calcVatForTaxType } from "@/lib/tax";
import { invoiceFormOptionGroup, resolveInvoiceForm } from "@/lib/invoice-form";
import { getTenantInvoiceScope } from "@/lib/tenant-theme";

// 매출(sales/[id]/print)에는 있던 인쇄 화면이 매입에는 아예 없었다 —
// 전체 감사에서 발견. 매입은 거래처(공급처)별 전용 서식(출고증 등)이
// 없으므로, 매출 인쇄 화면의 일반 명세표(InvoicePage) 분기만 그대로
// 가져온다.
export default async function PurchasePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string; layout?: string; balance?: string; lot?: string; form?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { copies: copiesParam, layout: layoutParam, balance: balanceParam, lot: lotParam } = sp;
  const copies: InvoiceCopies = copiesParam === "receiver" || copiesParam === "supplier" ? copiesParam : "both";
  const layout: InvoiceLayout = layoutParam === "full" ? "full" : "half";
  const showBalance = balanceParam === "show";
  const showLot = lotParam === "show";
  const supabase = await createClient();
  // 서식: ?form=a/b/n 으로 직접 고른 값(그 회사가 쓸 수 있는 것만)이 우선, 없으면 회사 테마의 기본 서식(클래식 B형 / 오성테크 외 전부·grid-modern 엘보닉스 A형). 고를 수 있는 서식은 회사마다 다르다(엘보닉스 A·B형=기본, 엔택스 A·B형=오성테크만). 엔택스 A형·엘보닉스 A형은 공급받는자 사업자 정보까지 채운다.
  const invoiceScope = await getTenantInvoiceScope(supabase);
  const form: InvoiceForm = resolveInvoiceForm(sp.form, invoiceScope);
  const formGroup = invoiceFormOptionGroup(form, invoiceScope);

  const [{ data: order }, { data: items }, { data: company }, { data: paperCalcs }] = await Promise.all([
    supabase.from("purchase_orders").select("*, suppliers(*)").eq("id", id).maybeSingle(),
    supabase
      .from("purchase_order_items")
      .select("*, products(sku, name, spec, unit, base_package_qty)")
      .eq("purchase_order_id", id)
      .order("created_at"),
    supabase.from("company_profile").select("*").maybeSingle(),
    supabase.from("paper_calculations").select("input_items").eq("purchase_order_id", id),
  ]);

  if (!order) {
    notFound();
  }

  const docNumber = String(order.doc_no);
  const supplierBalance = showBalance ? (await getSupplierBalance(supabase, order.supplier_id)).balance : undefined;

  let paperCalcSizes: { width: number; height: number; qty: number }[] = [];
  for (const calc of paperCalcs ?? []) {
    paperCalcSizes = mergePaperCalcInputItems(paperCalcSizes, calc.input_items);
  }
  const paperCalcSizeLines = formatPaperCalcSizeLines(paperCalcSizes);

  const invoiceItems: InvoiceItem[] = (items ?? []).flatMap((item) => {
    const supplyAmount = item.quantity * Number(item.unit_cost);
    const taxAmount = calcVatForTaxType(supplyAmount, order.tax_type);
    const d = new Date(order.purchase_date);
    const row: InvoiceItem = {
      id: item.id,
      monthDay: `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`,
      productLabel: (() => {
        const name = item.products?.name ?? item.custom_name ?? "";
        const spec = item.spec || item.products?.spec;
        const base = spec ? `${name} / ${spec}` : name;
        return showLot && item.lot_number ? `${base} / ${item.lot_number}` : base;
      })(),
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      unitPrice: Number(item.unit_cost),
      supplyAmount,
      taxAmount,
      remark: item.remark,
    };

    if (item.products?.sku !== PAPER_STOCK_SKU || paperCalcSizeLines.length === 0) {
      return [row];
    }

    const referenceRows: InvoiceItem[] = paperCalcSizeLines.map((line, i) => ({
      id: `${item.id}-size-${i}`,
      monthDay: "",
      productLabel: `ㄴ ${line}`,
      unit: "",
      quantity: 0,
      unitPrice: 0,
      supplyAmount: 0,
      taxAmount: 0,
      remark: null,
      isReference: true,
    }));
    return [row, ...referenceRows];
  });

  return (
    <InvoicePrintView
      basePath={`/purchases/${id}/print`}
      params={sp}
      closeHref="/purchases"
      title="입고명세표 인쇄"
      balanceLabel="미지급금"
      formGroup={formGroup}
      initial={{ form, copies, layout, showBalance }}
      balance={supplierBalance}
      invoice={{
        company,
        customerName: order.suppliers?.name ?? "",
        orderDate: order.purchase_date,
        docNumber,
        items: invoiceItems,
        memo: order.memo,
        customer: toInvoiceParty(order.suppliers),
      }}
    />
  );
}
