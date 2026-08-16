import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NewPurchaseForm } from "@/components/new-purchase-form";
import { updatePurchase } from "@/app/(dashboard)/purchases/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";

export default async function EditPurchasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const { id } = await params;
  const { back } = await searchParams;
  // 목록에서 검색/필터를 걸어둔 채로 상세 → 수정으로 들어왔으면, 저장 후
  // 상세가 아니라 그 검색 조건 그대로의 목록으로 돌아가게 한다(updatePurchase가
  // 이 값을 읽어 redirect 대상을 정한다). ESC/닫기는 기존처럼 상세로 간다.
  const supabase = await createClient();

  const [{ data: order }, { data: items }, { data: suppliers }, { data: products }, { data: warehouse }, { data: history }, actor] =
    await Promise.all([
      supabase.from("purchase_orders").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("purchase_order_items")
        .select("product_id, spec, quantity, unit_cost, remark, lot_number")
        .eq("purchase_order_id", id)
        .order("created_at"),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("products").select("id, sku, name, spec, unit, cost, base_package_qty").order("name"),
      supabase.from("warehouses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle(),
      supabase
        .from("purchase_order_items")
        .select("product_id, unit_cost, purchase_orders!inner(supplier_id, purchase_date)")
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
        <KeyboardShortcuts shortcuts={{ Escape: { href: `/purchases/${id}` } }} />
        <h1 className="mb-4 text-lg font-bold text-[var(--erp-text)]">매입 거래 수정</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          본인이 등록한 거래만 수정할 수 있습니다.
        </p>
      </div>
    );
  }

  const priceHistory = (history ?? []).map((row) => ({
    supplierId: row.purchase_orders.supplier_id,
    productId: row.product_id,
    unitCost: Number(row.unit_cost),
    purchaseDate: row.purchase_orders.purchase_date,
  }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: `/purchases/${id}` } }} />
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">매입 거래 수정</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={`/paper-calc?purchaseOrderId=${id}`} target="_blank" rel="noopener noreferrer" className="erp-btn">
            모조지 계산
          </Link>
          <Link href={`/purchases/${id}`} className="erp-btn erp-btn-danger">
            ESC 닫기
          </Link>
        </div>
      </div>
      <NewPurchaseForm
        suppliers={suppliers ?? []}
        products={products ?? []}
        warehouseId={warehouse?.id ?? order.warehouse_id}
        action={updatePurchase}
        submitLabel="매입 수정"
        backParam={back}
        history={priceHistory}
        initial={{
          id: order.id,
          supplierId: order.supplier_id,
          warehouseId: order.warehouse_id,
          purchaseDate: order.purchase_date,
          memo: order.memo ?? "",
          paymentMethod: order.payment_method,
          deliveryMethod: order.delivery_method,
          docNo: order.doc_no,
          items: (items ?? []).map((item) => ({
            productId: item.product_id,
            spec: item.spec,
            quantity: item.quantity,
            unitCost: Number(item.unit_cost),
            remark: item.remark,
            lotNumber: item.lot_number,
          })),
        }}
      />
    </div>
  );
}
