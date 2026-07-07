import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { DeliveryNoteDoc } from "@/components/delivery-note-doc";
import { InvoicePage, type InvoiceCopies } from "@/components/invoice/InvoicePage";

export default async function SalesPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string }>;
}) {
  const { id } = await params;
  const { copies: copiesParam } = await searchParams;
  const copies: InvoiceCopies =
    copiesParam === "receiver" || copiesParam === "supplier" ? copiesParam : "both";
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: company }] = await Promise.all([
    supabase.from("sales_orders").select("*, customers(*)").eq("id", id).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("*, products(sku, name, spec, unit, categories(name))")
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
    };
  });

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
      <InvoicePage
        company={company}
        customerName={order.customers?.name ?? ""}
        orderDate={order.order_date}
        docNumber={docNumber}
        items={invoiceItems}
        memo={order.memo}
        copies={copies}
      />
    </div>
  );
}
