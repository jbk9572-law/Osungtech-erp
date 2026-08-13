import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { DeliveryNoteDoc } from "@/components/delivery-note-doc";
import {
  SnsFiltechCanvas,
  ZenithTechCanvas,
  KtSolutionCanvas,
} from "@/components/delivery-note-v2/DeliveryNoteCanvas";
import { InvoicePage, type InvoiceCopies, type InvoiceLayout } from "@/components/invoice/InvoicePage";
import type { InvoiceItem } from "@/components/invoice/types";
import { formatPaperCalcSizeLines, mergePaperCalcInputItems } from "@/lib/paper-calc-summary";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";
import { getCustomerBalance } from "@/lib/ar-ap";

export default async function SalesPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string; layout?: string; balance?: string }>;
}) {
  const { id } = await params;
  const { copies: copiesParam, layout: layoutParam, balance: balanceParam } = await searchParams;
  const copies: InvoiceCopies =
    copiesParam === "receiver" || copiesParam === "supplier" ? copiesParam : "both";
  const layout: InvoiceLayout = layoutParam === "full" ? "full" : "half";
  // 실무에서 거의 안 쓰는 기능이라 기본은 "표기 안함" — 명시적으로
  // ?balance=show를 눌러야만 전잔금/총잔금 칸에 실제 잔액이 찍힌다.
  const showBalance = balanceParam === "show";
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: company }, { data: paperCalcs }] = await Promise.all([
    supabase.from("sales_orders").select("*, customers(*)").eq("id", id).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("*, products(sku, name, spec, unit, base_package_qty, categories(name))")
      .eq("sales_order_id", id)
      .order("created_at"),
    supabase.from("company_profile").select("*").eq("id", 1).maybeSingle(),
    supabase.from("paper_calculations").select("input_items").eq("sales_order_id", id),
  ]);

  if (!order) {
    notFound();
  }

  const docType = order.customers?.document_type ?? "명세표";
  const docNumber = String(order.doc_no);
  // 출고증은 금액 자체가 없는 서식이라 미수금 잔액도 의미가 없다 — 명세표
  // 문서에서 표기를 켰을 때만 조회한다.
  const customerBalance =
    showBalance && docType !== "출고증" ? (await getCustomerBalance(supabase, order.customer_id)).balance : undefined;

  if (docType === "출고증") {
    const variant = order.customers?.delivery_note_variant ?? null;

    // sns_filtech: 실제 PDF 벡터 좌표를 그대로 옮긴 정밀 재현 버전.
    // 그 외 변형은 아직 구조적 근사치(DeliveryNoteDoc)를 사용한다.
    if (variant === "sns_filtech") {
      const canvasItems = (items ?? []).map((item) => ({
        id: item.id,
        category: item.products?.categories?.name ?? "",
        productName: item.products?.name ?? "",
        spec: item.spec || item.products?.spec || "",
        sku: item.products?.sku ?? "",
        unit: item.products?.unit ?? "",
        quantity: item.quantity,
        basePackageQty: item.products?.base_package_qty != null ? Number(item.products.base_package_qty) : null,
        remark: item.remark,
      }));

      return (
        <div className="mx-auto print:mx-0" style={{ width: "595.32pt" }}>
          <div className="mb-4 flex items-center justify-between print:hidden">
            <Link href="/sales" className="print:hidden rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              목록으로
            </Link>
            <PrintButton />
          </div>
          <SnsFiltechCanvas
            company={company}
            customerName={order.customers?.name ?? ""}
            customerAddress={order.customers?.address ?? null}
            customerContactName={order.customers?.contact_name ?? null}
            customerContactPhone={order.customers?.phone ?? null}
            orderDate={order.order_date}
            items={canvasItems}
            note={order.memo}
          />
        </div>
      );
    }

    if (variant === "zenith_tech") {
      // 제니스테크는 규격 칸에 품목명과 규격을 같이 보여준다("품목명 / 규격").
      const canvasItems = (items ?? []).map((item) => ({
        id: item.id,
        category: item.products?.categories?.name ?? "",
        productName: item.products?.name ?? "",
        spec: item.spec || item.products?.spec || "",
        sku: item.products?.sku ?? "",
        unit: item.products?.unit ?? "",
        quantity: item.quantity,
        basePackageQty: item.products?.base_package_qty != null ? Number(item.products.base_package_qty) : null,
        remark: item.remark,
      }));

      return (
        <div className="mx-auto print:mx-0" style={{ width: "595.32pt" }}>
          <div className="mb-4 flex items-center justify-between print:hidden">
            <Link href="/sales" className="print:hidden rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              목록으로
            </Link>
            <PrintButton />
          </div>
          <ZenithTechCanvas
            company={company}
            customerName={order.customers?.name ?? ""}
            customerAddress={order.customers?.address ?? null}
            customerContactName={order.customers?.contact_name ?? null}
            customerContactPhone={order.customers?.phone ?? null}
            orderDate={order.order_date}
            items={canvasItems}
            note={order.memo}
          />
        </div>
      );
    }

    if (variant === "ket_solution") {
      // 케이이티솔루션은 주문 등록 시 "규격" 입력칸에 실제 규격 대신 배치/롯
      // 관리번호(예: 260521 - 101)를 적기 때문에, 규격 칸은 품목명을 보여주고
      // 사용자가 입력한 값은 관리번호로 보여준다. 메모는 이 서식에는 넣지 않는다.
      const canvasItems = (items ?? []).map((item) => ({
        id: item.id,
        category: item.products?.categories?.name ?? "",
        productName: item.products?.name ?? "",
        spec: item.products?.name || "",
        sku: item.products?.sku ?? "",
        unit: item.products?.unit ?? "",
        quantity: item.quantity,
        basePackageQty: item.products?.base_package_qty != null ? Number(item.products.base_package_qty) : null,
        remark: item.remark,
        lotNo: item.spec || null,
      }));

      return (
        <div className="mx-auto print:mx-0" style={{ width: "595.32pt" }}>
          <div className="mb-4 flex items-center justify-between print:hidden">
            <Link href="/sales" className="print:hidden rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
              목록으로
            </Link>
            <PrintButton />
          </div>
          <KtSolutionCanvas
            company={company}
            customerName={order.customers?.name ?? ""}
            customerAddress={order.customers?.address ?? null}
            customerContactName={order.customers?.contact_name ?? null}
            customerContactPhone={order.customers?.phone ?? null}
            orderDate={order.order_date}
            items={canvasItems}
          />
        </div>
      );
    }

    const deliveryItems = (items ?? []).map((item) => ({
      id: item.id,
      category: item.products?.categories?.name ?? "",
      productName: item.products?.name ?? "",
      spec: item.spec || item.products?.spec || "",
      sku: item.products?.sku ?? "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      remark: item.remark,
    }));

    return (
      <div className="mx-auto max-w-3xl print-page-wrapper">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link href="/sales" className="print:hidden rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            목록으로
          </Link>
          <PrintButton />
        </div>
        <DeliveryNoteDoc
          company={company}
          customerName={order.customers?.name ?? ""}
          customerAddress={order.customers?.address ?? null}
          customerContactName={order.customers?.contact_name ?? null}
          customerContactPhone={order.customers?.phone ?? null}
          orderDate={order.order_date}
          items={deliveryItems}
          note={order.memo}
          variant={variant}
        />
      </div>
    );
  }

  // 모조지(TG0) 계산에 들어간 사이즈별 수량(가로×세로:수량) — 원지 자체는
  // 연 단위로만 청구되고 이 사이즈들은 그 원지로 만드는 최종 상품일 뿐이라,
  // TG0 줄 바로 아래에 참고용(수량/금액 없이)으로만 인쇄에도 보여준다.
  let paperCalcSizes: { width: number; height: number; qty: number }[] = [];
  for (const calc of paperCalcs ?? []) {
    paperCalcSizes = mergePaperCalcInputItems(paperCalcSizes, calc.input_items);
  }
  const paperCalcSizeLines = formatPaperCalcSizeLines(paperCalcSizes);

  const invoiceItems: InvoiceItem[] = (items ?? []).flatMap((item) => {
    const supplyAmount = item.quantity * Number(item.unit_price);
    const taxAmount = Math.round(supplyAmount * 0.1);
    const d = new Date(order.order_date);
    const row: InvoiceItem = {
      id: item.id,
      monthDay: `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`,
      productLabel: (() => {
        const name = item.products?.name ?? "";
        const spec = item.spec || item.products?.spec;
        return spec ? `${name}/${spec}` : name;
      })(),
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
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
    <div
      className={`mx-auto max-w-5xl print:mx-0 print:max-w-none ${layout === "half" ? "print-page-wrapper" : ""}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/sales" className="print:hidden rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          목록으로
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-md border border-gray-200 p-1 text-sm">
            {(
              [
                ["both", "양쪽 다"],
                ["receiver", "공급받는자만"],
                ["supplier", "공급자만"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={`/sales/${id}/print?copies=${value}&layout=${layout}&balance=${showBalance ? "show" : "hide"}`}
                className={`rounded px-3 py-1.5 ${
                  copies === value ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="flex gap-1 rounded-md border border-gray-200 p-1 text-sm">
            {(
              [
                ["half", "2연식"],
                ["full", "전지"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={`/sales/${id}/print?copies=${copies}&layout=${value}&balance=${showBalance ? "show" : "hide"}`}
                className={`rounded px-3 py-1.5 ${
                  layout === value ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="flex gap-1 rounded-md border border-gray-200 p-1 text-sm">
            {(
              [
                ["hide", "미수금 표기 안함"],
                ["show", "미수금 표기"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={`/sales/${id}/print?copies=${copies}&layout=${layout}&balance=${value}`}
                className={`rounded px-3 py-1.5 ${
                  (showBalance ? "show" : "hide") === value
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
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
        customerName={order.customers?.name ?? ""}
        orderDate={order.order_date}
        docNumber={docNumber}
        items={invoiceItems}
        memo={order.memo}
        copies={copies}
        layout={layout}
        balance={customerBalance}
      />
    </div>
  );
}
