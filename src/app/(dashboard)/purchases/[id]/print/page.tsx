import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { PrintOptionBar } from "@/components/print-option-bar";
import { CloseButton } from "@/components/erp/close-button";
import { InvoicePage, type InvoiceCopies, type InvoiceLayout } from "@/components/invoice/InvoicePage";
import { toInvoiceParty, type InvoiceForm, type InvoiceItem } from "@/components/invoice/types";
import { formatPaperCalcSizeLines, mergePaperCalcInputItems } from "@/modules/paper-calc/public";
import { PAPER_STOCK_SKU } from "@/modules/paper-calc/public";
import { getSupplierBalance } from "@/lib/ar-ap";
import { calcVatForTaxType } from "@/lib/tax";

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
  // 서식: 기본은 지금까지 쓰던 B형. ?form=a 일 때만 A형(공급받는자 사업자 정보까지 채움).
  const form: InvoiceForm = sp.form === "a" ? "A" : "B";
  const showBalance = balanceParam === "show";
  const showLot = lotParam === "show";
  const supabase = await createClient();

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
    <div className={`mx-auto max-w-5xl print:mx-0 print:max-w-none ${layout === "half" ? "print-page-wrapper" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <CloseButton href="/purchases" className="erp-btn erp-btn-dark print:hidden">
          목록으로
        </CloseButton>
        <PrintButton autoPrint={false} />
      </div>
      <PrintOptionBar
        basePath={`/purchases/${id}/print`}
        params={sp}
        groups={[
          {
            key: "form",
            label: "서식",
            current: form === "A" ? "a" : "b",
            options: [
              { value: "b", label: "B형" },
              { value: "a", label: "A형" },
            ],
          },
          {
            key: "copies",
            label: "출력",
            current: copies,
            options: [
              { value: "both", label: "양쪽 다" },
              { value: "receiver", label: "공급받는자만" },
              { value: "supplier", label: "공급자만" },
            ],
          },
          {
            key: "layout",
            label: "용지",
            current: layout,
            options: [
              { value: "half", label: "2연식" },
              { value: "full", label: "전지" },
            ],
          },
          {
            key: "balance",
            label: "미지급금",
            current: showBalance ? "show" : "hide",
            options: [
              { value: "hide", label: "표기 안함" },
              { value: "show", label: "표기" },
            ],
          },
        ]}
      />
      <InvoicePage
        company={company}
        customerName={order.suppliers?.name ?? ""}
        orderDate={order.purchase_date}
        docNumber={docNumber}
        items={invoiceItems}
        memo={order.memo}
        copies={copies}
        layout={layout}
        form={form}
        customer={toInvoiceParty(order.suppliers)}
        balance={supplierBalance}
      />
    </div>
  );
}
