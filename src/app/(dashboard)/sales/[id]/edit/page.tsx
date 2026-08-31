import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewSaleForm } from "@/components/new-sale-form";
import { updateSale } from "@/app/(dashboard)/sales/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";

export default async function EditSalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const { back } = await searchParams;
  // 목록에서 검색/필터를 걸어둔 채로 상세 → 수정으로 들어왔으면, 저장 후
  // 상세가 아니라 그 검색 조건 그대로의 목록으로 돌아가게 한다(updateSale이
  // 이 값을 읽어 redirect 대상을 정한다). ESC/닫기는 기존처럼 상세로 간다.
  const supabase = await createClient();

  const [
    { data: order },
    { data: items },
    { data: customers },
    { data: products },
    { data: warehouse },
    { data: prices },
    { data: history },
    actor,
  ] = await Promise.all([
    supabase.from("sales_orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("product_id, spec, quantity, unit_price, remark, lot_number")
      .eq("sales_order_id", id)
      .order("created_at"),
    supabase.from("customers").select("id, name, notes").order("name"),
    supabase
      .from("products")
      .select(
        "id, sku, name, spec, unit, price, base_package_qty, inventory(quantity)",
      )
      .order("name"),
    supabase
      .from("warehouses")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("customer_product_prices")
      .select("customer_id, product_id, unit_price"),
    supabase
      .from("sales_order_items")
      .select(
        "product_id, unit_price, lot_number, sales_orders!inner(customer_id, order_date)",
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    getCurrentActor(supabase),
  ]);

  if (!order) {
    notFound();
  }

  if (!canManage(order.created_by, actor.userId, actor.isAdmin)) {
    return (
      <div>
        <KeyboardShortcuts shortcuts={{ Escape: { href: `/sales/${id}` } }} />
        <h1 className="mb-4 text-lg font-bold text-[var(--erp-text)]">
          매출 거래 수정
        </h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          본인이 등록한 거래만 수정할 수 있습니다.
        </p>
      </div>
    );
  }

  const priceHistory = (history ?? []).map((row) => ({
    customerId: row.sales_orders.customer_id,
    productId: row.product_id,
    unitPrice: Number(row.unit_price),
    orderDate: row.sales_orders.order_date,
    lotNumber: row.lot_number,
  }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: `/sales/${id}` } }} />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">
          매출 거래 수정
        </h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link
            href={`/paper-calc?salesOrderId=${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="erp-btn"
          >
            모조지 계산
          </Link>
          <Link href={`/sales/${id}`} className="erp-btn erp-btn-danger">
            ESC 닫기
          </Link>
        </div>
      </div>
      <NewSaleForm
        customers={customers ?? []}
        products={(products ?? []).map((p) => ({
          ...p,
          stock: p.inventory?.[0]?.quantity ?? 0,
        }))}
        warehouseId={warehouse?.id ?? order.warehouse_id}
        prices={prices ?? []}
        history={priceHistory}
        action={updateSale}
        submitLabel="매출 수정"
        backParam={back}
        initial={{
          id: order.id,
          customerId: order.customer_id,
          warehouseId: order.warehouse_id,
          orderDate: order.order_date,
          memo: order.memo ?? "",
          paymentMethod: order.payment_method,
          deliveryMethod: order.delivery_method,
          docNo: order.doc_no,
          isReturn: order.is_return,
          returnReason: order.return_reason,
          isCarryover: order.is_carryover,
          items: (items ?? []).map((item) => ({
            productId: item.product_id,
            spec: item.spec,
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
            remark: item.remark,
            lotNumber: item.lot_number,
          })),
        }}
      />
    </div>
  );
}
