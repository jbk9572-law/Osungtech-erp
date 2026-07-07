import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { DeliveryNoteDoc } from "@/components/delivery-note-doc";
import { InvoiceDoc } from "@/components/invoice-doc";

type Copies = "both" | "receiver" | "supplier";

export default async function SalesPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string }>;
}) {
  const { id } = await params;
  const { copies: copiesParam } = await searchParams;
  const copies: Copies =
    copiesParam === "receiver" || copiesParam === "supplier" ? copiesParam : "both";
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: company }] = await Promise.all([
    supabase.from("sales_orders").select("*, customers(*)").eq("id", id).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("*, products(sku, name, unit, categories(name))")
      .eq("sales_order_id", id)
      .order("created_at"),
    supabase.from("company_profile").select("*").eq("id", 1).maybeSingle(),
  ]);

  if (!order) {
    notFound();
  }

  const docType = order.customers?.document_type ?? "명세표";
  const docNumber = String(order.doc_no);

  if (docType === "출고증") {
    const deliveryItems = (items ?? []).map((item) => ({
      id: item.id,
      category: item.products?.categories?.name ?? "",
      productName: item.products?.name ?? "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
    }));

    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex justify-end print:hidden">
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
        />
      </div>
    );
  }

  const invoiceItems = (items ?? []).map((item) => {
    const supplyAmount = item.quantity * Number(item.unit_price);
    const taxAmount = Math.round(supplyAmount * 0.1);
    const d = new Date(order.order_date);
    return {
      id: item.id,
      monthDay: `${d.getMonth() + 1}/${d.getDate()}`,
      productLabel: item.products?.categories?.name
        ? `${item.products.categories.name}/${item.products.name}`
        : (item.products?.name ?? ""),
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      supplyAmount,
      taxAmount,
    };
  });

  const showReceiver = copies === "both" || copies === "receiver";
  const showSupplier = copies === "both" || copies === "supplier";

  return (
    <div className="mx-auto max-w-5xl print:mx-0 print:max-w-none">
      <div className="mb-4 flex items-center justify-between print:hidden">
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
              href={`/sales/${id}/print?copies=${value}`}
              className={`rounded px-3 py-1.5 ${
                copies === value ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <PrintButton />
      </div>
      <div className="overflow-x-auto break-inside-avoid">
        {showReceiver && (
          <InvoiceDoc
            copyLabel="공급받는자 보관용"
            color="blue"
            company={company}
            customerName={order.customers?.name ?? ""}
            orderDate={order.order_date}
            docNumber={docNumber}
            items={invoiceItems}
            memo={order.memo}
          />
        )}
        {showReceiver && showSupplier && <CutLine />}
        {showSupplier && (
          <InvoiceDoc
            copyLabel="공급자 보관용"
            color="red"
            company={company}
            customerName={order.customers?.name ?? ""}
            orderDate={order.order_date}
            docNumber={docNumber}
            items={invoiceItems}
            memo={order.memo}
          />
        )}
      </div>
    </div>
  );
}

function CutLine() {
  return (
    <div className="my-2 flex items-center gap-2 text-[11px] text-gray-400">
      <span className="flex-1 border-t border-dashed border-gray-400" />
      <span>✂ 절취선 ✂</span>
      <span className="flex-1 border-t border-dashed border-gray-400" />
    </div>
  );
}
