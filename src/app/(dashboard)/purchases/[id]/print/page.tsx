import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { CloseButton } from "@/components/erp/close-button";
import { InvoicePage, type InvoiceCopies, type InvoiceLayout } from "@/components/invoice/InvoicePage";
import type { InvoiceItem } from "@/components/invoice/types";
import { formatPaperCalcSizeLines, mergePaperCalcInputItems } from "@/lib/paper-calc-summary";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";
import { getSupplierBalance } from "@/lib/ar-ap";
import { calcVat } from "@/lib/tax";

// 매출(sales/[id]/print)에는 있던 인쇄 화면이 매입에는 아예 없었다 —
// 전체 감사에서 발견. 매입은 거래처(공급처)별 전용 서식(출고증 등)이
// 없으므로, 매출 인쇄 화면의 일반 명세표(InvoicePage) 분기만 그대로
// 가져온다.
export default async function PurchasePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string; layout?: string; balance?: string; lot?: string }>;
}) {
  const { id } = await params;
  const { copies: copiesParam, layout: layoutParam, balance: balanceParam, lot: lotParam } = await searchParams;
  const copies: InvoiceCopies = copiesParam === "receiver" || copiesParam === "supplier" ? copiesParam : "both";
  const layout: InvoiceLayout = layoutParam === "full" ? "full" : "half";
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
    const taxAmount = calcVat(supplyAmount);
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <CloseButton href="/purchases" className="erp-btn erp-btn-dark print:hidden">
          목록으로
        </CloseButton>
        <div className="flex flex-wrap items-center gap-2">
          <div className="erp-seg">
            {(
              [
                ["both", "양쪽 다"],
                ["receiver", "공급받는자만"],
                ["supplier", "공급자만"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={`/purchases/${id}/print?copies=${value}&layout=${layout}&balance=${showBalance ? "show" : "hide"}`}
                replace
                className={`erp-seg-btn${copies === value ? " active" : ""}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="erp-seg">
            {(
              [
                ["half", "2연식"],
                ["full", "전지"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={`/purchases/${id}/print?copies=${copies}&layout=${value}&balance=${showBalance ? "show" : "hide"}`}
                replace
                className={`erp-seg-btn${layout === value ? " active" : ""}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="erp-seg">
            {(
              [
                ["hide", "미지급금 표기 안함"],
                ["show", "미지급금 표기"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={`/purchases/${id}/print?copies=${copies}&layout=${layout}&balance=${value}`}
                replace
                className={`erp-seg-btn${(showBalance ? "show" : "hide") === value ? " active" : ""}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <PrintButton autoPrint={false} />
      </div>
      <InvoicePage
        company={company}
        customerName={order.suppliers?.name ?? ""}
        orderDate={order.purchase_date}
        docNumber={docNumber}
        items={invoiceItems}
        memo={order.memo}
        copies={copies}
        layout={layout}
        balance={supplierBalance}
      />
    </div>
  );
}
