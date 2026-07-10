import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPurchaseForm } from "@/components/new-purchase-form";
import { updatePurchase } from "@/app/(dashboard)/purchases/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: suppliers }, { data: products }, { data: warehouse }] =
    await Promise.all([
      supabase.from("purchase_orders").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("purchase_order_items")
        .select("product_id, spec, quantity, unit_cost")
        .eq("purchase_order_id", id)
        .order("created_at"),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("products").select("id, sku, name, spec, unit, cost, base_package_qty").order("name"),
      supabase.from("warehouses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    ]);

  if (!order) {
    notFound();
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: `/purchases/${id}` } }} />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">매입 거래 수정</h1>
        <Link href={`/purchases/${id}`} className="erp-btn">
          ESC 닫기
        </Link>
      </div>
      <NewPurchaseForm
        suppliers={suppliers ?? []}
        products={products ?? []}
        warehouseId={warehouse?.id ?? order.warehouse_id}
        action={updatePurchase}
        submitLabel="매입 수정"
        initial={{
          id: order.id,
          supplierId: order.supplier_id,
          warehouseId: order.warehouse_id,
          purchaseDate: order.purchase_date,
          memo: order.memo ?? "",
          items: (items ?? []).map((item) => ({
            productId: item.product_id,
            spec: item.spec,
            quantity: item.quantity,
            unitCost: Number(item.unit_cost),
          })),
        }}
      />
    </div>
  );
}
