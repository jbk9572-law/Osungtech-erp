import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewPurchaseForm } from "@/components/new-purchase-form";
import { updatePurchase } from "@/app/(dashboard)/purchases/actions";

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: suppliers }, { data: products }, { data: warehouses }] =
    await Promise.all([
      supabase.from("purchase_orders").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("purchase_order_items")
        .select("product_id, quantity, unit_cost")
        .eq("purchase_order_id", id)
        .order("created_at"),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("products").select("id, sku, name, spec, cost").order("name"),
      supabase.from("warehouses").select("id, name").order("name"),
    ]);

  if (!order) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">매입 거래 수정</h1>
      <NewPurchaseForm
        suppliers={suppliers ?? []}
        products={products ?? []}
        warehouses={warehouses ?? []}
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
            quantity: item.quantity,
            unitCost: Number(item.unit_cost),
          })),
        }}
      />
    </div>
  );
}
