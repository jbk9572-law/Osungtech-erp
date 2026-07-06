import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { DeliveryNoteDoc } from "@/components/delivery-note-doc";
import { InvoiceDoc } from "@/components/invoice-doc";

export default async function SalesPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
  const docNumber = order.id.slice(0, 8).toUpperCase();

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
          orderDate={order.order_date}
          items={deliveryItems}
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <div className="space-y-4">
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
      </div>
    </div>
  );
}
