import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewSaleForm } from "@/components/new-sale-form";
import { updateSale } from "@/app/(dashboard)/sales/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: order },
    { data: items },
    { data: customers },
    { data: products },
    { data: warehouse },
    { data: prices },
    { data: history },
  ] = await Promise.all([
    supabase.from("sales_orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("product_id, spec, quantity, unit_price, remark")
      .eq("sales_order_id", id)
      .order("created_at"),
    supabase.from("customers").select("id, name").order("name"),
    supabase
      .from("products")
      .select("id, sku, name, spec, unit, price, base_package_qty, inventory(quantity)")
      .order("name"),
    supabase.from("warehouses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("customer_product_prices").select("customer_id, product_id, unit_price"),
    supabase
      .from("sales_order_items")
      .select("product_id, unit_price, sales_orders!inner(customer_id, order_date)")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  if (!order) {
    notFound();
  }

  const priceHistory = (history ?? []).map((row) => ({
    customerId: row.sales_orders.customer_id,
    productId: row.product_id,
    unitPrice: Number(row.unit_price),
    orderDate: row.sales_orders.order_date,
  }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: `/sales/${id}` } }} />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1c1c1c]">매출 거래 수정</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={`/paper-calc?salesOrderId=${id}`} target="_blank" rel="noopener noreferrer" className="erp-btn">
            모조지 계산
          </Link>
          <Link href={`/sales/${id}`} className="erp-btn erp-btn-danger">
            ESC 닫기
          </Link>
        </div>
      </div>
      <NewSaleForm
        customers={customers ?? []}
        products={(products ?? []).map((p) => ({ ...p, stock: p.inventory?.[0]?.quantity ?? 0 }))}
        warehouseId={warehouse?.id ?? order.warehouse_id}
        prices={prices ?? []}
        history={priceHistory}
        action={updateSale}
        submitLabel="매출 수정"
        initial={{
          id: order.id,
          customerId: order.customer_id,
          warehouseId: order.warehouse_id,
          orderDate: order.order_date,
          memo: order.memo ?? "",
          items: (items ?? []).map((item) => ({
            productId: item.product_id,
            spec: item.spec,
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
            remark: item.remark,
          })),
        }}
      />
    </div>
  );
}
