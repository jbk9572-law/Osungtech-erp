import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { formatNumber } from "@/lib/format-number";
import { todayKstStr } from "@/lib/kst-date";
import {
  CustomerOrderApproveForm,
  CustomerOrderRejectForm,
  ConvertToWorkOrderForm,
  ConvertToSaleForm,
  ShippingStatusForm,
} from "@/components/customer-order-review-forms";

const TABS = [
  { key: "requested", label: "검토 대기" },
  { key: "approved", label: "승인됨" },
  { key: "rejected", label: "반려" },
] as const;

export default async function CustomerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "production");

  const activeTab: "requested" | "approved" | "rejected" = TABS.some((t) => t.key === status)
    ? (status as "requested" | "approved" | "rejected")
    : "requested";

  const [{ data: orders }, { data: warehouses }] = await Promise.all([
    supabase
      .from("customer_orders")
      .select(
        "id, doc_no, status, memo, reject_reason, shipping_status, created_at, customer_id, work_order_id, sales_order_id, customers(name), customer_order_items(product_id, quantity, unit_price, products(sku, name, spec, unit)), work_orders(status)",
      )
      .eq("status", activeTab)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("warehouses").select("id, name").order("name"),
  ]);

  // 품목별로 "우리가 만드는 품목(BOM 있음)"인지 "사입해서 그대로 파는
  // 품목(BOM 없음)"인지에 따라 승인 후 전환 버튼을 생산지시/판매로
  // 가른다 — BOM 없는 품목엔 생산지시를 낼 수 없어서(create_work_order가
  // 거부함), 지금까지는 그런 주문을 승인해도 전환할 방법이 없었다.
  const productIds = Array.from(
    new Set((orders ?? []).flatMap((o) => (o.customer_order_items ?? []).map((i) => i.product_id))),
  );
  const { data: bomRows } = productIds.length
    ? await supabase.from("bom_items").select("parent_product_id").in("parent_product_id", productIds)
    : { data: [] as { parent_product_id: string }[] };
  const manufacturedProductIds = new Set((bomRows ?? []).map((b) => b.parent_product_id));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">생산관리 &gt; 거래처 발주 승인</h1>

      <PageGuide>
        거래처가 외부 포털에서 넣은 발주 요청입니다. 승인하면 품목이
        BOM(구성품)이 등록된 제조품인지, 사입해서 그대로 파는 사입품인지에
        따라 아래에서 생산지시 또는 판매로 전환하고, 배송 상태를 거래처
        포털에 보여줄 수 있습니다.
      </PageGuide>

      <div className="erp-toolbar">
        {TABS.map((t) => (
          <a
            key={t.key}
            href={`/customer-orders?status=${t.key}`}
            className={`erp-btn${activeTab === t.key ? " erp-btn-primary" : ""}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {(orders ?? []).map((o) => {
          const total = (o.customer_order_items ?? []).reduce(
            (sum, i) => sum + Number(i.quantity) * Number(i.unit_price),
            0,
          );
          return (
            <div key={o.id} className="erp-home-panel" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 700 }}>{o.customers?.name ?? "-"}</span>
                  <span style={{ marginLeft: 8, color: "var(--erp-text-muted)", fontSize: 12 }}>
                    주문 {o.doc_no} · {new Date(o.created_at).toLocaleString("ko-KR")}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {formatNumber(total)}원
                </span>
              </div>

              {(() => {
                const isConverted = Boolean(o.work_order_id || o.sales_order_id);
                return (
                  <table className="erp-grid" style={{ marginBottom: 8 }}>
                    <thead>
                      <tr>
                        <th>품목</th>
                        <th style={{ width: 90 }}>규격</th>
                        <th className="num" style={{ width: 100 }}>수량</th>
                        <th className="num" style={{ width: 100 }}>단가</th>
                        {activeTab === "approved" && !isConverted && <th style={{ width: 280 }}>전환</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(o.customer_order_items ?? []).map((item) => {
                        const manufactured = manufacturedProductIds.has(item.product_id);
                        return (
                          <tr key={item.product_id}>
                            <td>
                              {item.products?.sku} · {item.products?.name}
                              {activeTab === "approved" && !isConverted && (
                                <span
                                  className={`erp-badge ${manufactured ? "erp-badge-info" : "erp-badge-muted"}`}
                                  style={{ marginLeft: 6 }}
                                >
                                  {manufactured ? "제조품" : "사입품"}
                                </span>
                              )}
                            </td>
                            <td>{item.products?.spec ?? "-"}</td>
                            <td className="num">
                              {formatNumber(Number(item.quantity))} {item.products?.unit}
                            </td>
                            <td className="num">{formatNumber(Number(item.unit_price))}</td>
                            {activeTab === "approved" && !isConverted && (
                              <td>
                                {manufactured ? (
                                  <ConvertToWorkOrderForm
                                    orderId={o.id}
                                    productId={item.product_id}
                                    quantity={Number(item.quantity)}
                                    warehouses={warehouses ?? []}
                                    today={todayKstStr()}
                                  />
                                ) : (
                                  <ConvertToSaleForm
                                    orderId={o.id}
                                    customerId={o.customer_id}
                                    productId={item.product_id}
                                    quantity={Number(item.quantity)}
                                    unitPrice={Number(item.unit_price)}
                                    warehouses={warehouses ?? []}
                                    today={todayKstStr()}
                                  />
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}

              {o.memo && (
                <p style={{ fontSize: 12, color: "var(--erp-text-muted)", marginBottom: 8 }}>요청사항: {o.memo}</p>
              )}

              {activeTab === "requested" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <CustomerOrderApproveForm id={o.id} />
                  <CustomerOrderRejectForm id={o.id} />
                </div>
              )}

              {activeTab === "approved" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {o.work_order_id ? (
                    <span className="erp-badge erp-badge-info">
                      {`생산지시 연결됨(${o.work_orders?.status === "completed" ? "생산완료" : o.work_orders?.status === "material_issued" ? "생산중" : "생산대기"})`}
                    </span>
                  ) : o.sales_order_id ? (
                    <span className="erp-badge erp-badge-info">판매로 연결됨</span>
                  ) : (
                    <span className="erp-badge erp-badge-muted">생산지시/판매 미연결</span>
                  )}
                  <span className="erp-badge erp-badge-muted">
                    배송: {o.shipping_status === "delivered" ? "완료" : o.shipping_status === "shipped" ? "배송중" : "대기"}
                  </span>
                  {o.shipping_status === "pending" && <ShippingStatusForm id={o.id} status="shipped" label="배송중 처리" />}
                  {o.shipping_status === "shipped" && <ShippingStatusForm id={o.id} status="delivered" label="배송완료 처리" />}
                </div>
              )}

              {activeTab === "rejected" && o.reject_reason && (
                <p style={{ fontSize: 12, color: "var(--erp-danger)" }}>반려 사유: {o.reject_reason}</p>
              )}
            </div>
          );
        })}
        {(!orders || orders.length === 0) && (
          <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
            해당하는 주문이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
