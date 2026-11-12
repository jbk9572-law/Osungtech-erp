import type { SandboxApi } from "./api";

// 테스트용 매출/매입을 DB 함수(RPC)로 직접 만들고 지우는 도우미.
// 만든 거래에는 항상 고유한 표식(memo)을 달아서, 테스트가 중간에 죽어도 표식으로
// 찾아 정리할 수 있다.
export function uniqueTag(label: string) {
  return `[e2e-${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}]`;
}

export async function createSale(
  api: SandboxApi,
  opts: { date: string; memo: string; quantity?: number; carryover?: boolean },
) {
  const r = await api.rpc<string>("create_sale_with_items", {
    p_customer_id: api.ids.customer, p_warehouse_id: api.ids.warehouse, p_order_date: opts.date,
    p_memo: opts.memo, p_created_by: api.userId,
    p_items: [{ productId: api.ids.product, quantity: opts.quantity ?? 3, unitPrice: 300 }],
    p_payment_method: null, p_delivery_method: null, p_doc_no: null, p_is_return: false,
    p_return_reason: null, p_is_carryover: opts.carryover ?? false, p_tax_type: "과세",
    p_evidence_type: null, p_is_sample: false,
  });
  if (r.status !== 200) throw new Error(`매출 생성 실패: ${JSON.stringify(r.body)}`);
  return r.body;
}

export async function createPurchase(api: SandboxApi, opts: { date: string; memo: string; quantity?: number }) {
  const r = await api.rpc<string>("create_purchase_with_items", {
    p_supplier_id: api.ids.supplier, p_warehouse_id: api.ids.warehouse, p_purchase_date: opts.date,
    p_memo: opts.memo, p_created_by: api.userId,
    p_items: [{ productId: api.ids.product, quantity: opts.quantity ?? 3, unitCost: 150 }],
    p_payment_method: null, p_delivery_method: null, p_doc_no: null, p_is_carryover: false,
    p_tax_type: "과세", p_evidence_type: null,
  });
  if (r.status !== 200) throw new Error(`매입 생성 실패: ${JSON.stringify(r.body)}`);
  return r.body;
}

export async function createCombo(
  api: SandboxApi,
  opts: { date: string; memo: string; purchaseQty: number; saleQty: number },
) {
  const r = await api.rpc<{ purchase_order_id: string; sale_order_id: string }[]>("create_purchase_and_sale_with_items", {
    p_supplier_id: api.ids.supplier, p_customer_id: api.ids.customer, p_warehouse_id: api.ids.warehouse,
    p_purchase_date: opts.date, p_sale_date: opts.date, p_purchase_memo: opts.memo, p_sale_memo: opts.memo,
    p_created_by: api.userId,
    p_purchase_items: [{ productId: api.ids.product, quantity: opts.purchaseQty, unitCost: 150 }],
    p_sale_items: [{ productId: api.ids.product, quantity: opts.saleQty, unitPrice: 300 }],
    p_payment_method: null, p_delivery_method: null, p_purchase_doc_no: null, p_sale_doc_no: null,
    p_sale_delivery_method: null, p_tax_type: "과세", p_evidence_type: null,
  });
  if (r.status !== 200) throw new Error(`동시등록 실패: ${JSON.stringify(r.body)}`);
  return r.body[0];
}

export const deleteSale = (api: SandboxApi, id: string) =>
  api.rpc("delete_sale_with_items", { p_id: id, p_deleted_by: api.userId });
export const deletePurchase = (api: SandboxApi, id: string) =>
  api.rpc("delete_purchase_with_items", { p_id: id, p_deleted_by: api.userId });

/** 표식(memo)이 들어간 테스트 거래를 모두 지운다. 매출을 먼저, 그다음 매입. */
export async function cleanupTagged(api: SandboxApi, tag: string) {
  const like = `like.*${encodeURIComponent(tag)}*`;
  const sales = await api.rest<{ id: string }[]>(`sales_orders?select=id&memo=${like}`);
  for (const s of Array.isArray(sales.body) ? sales.body : []) await deleteSale(api, s.id);
  const purchases = await api.rest<{ id: string }[]>(`purchase_orders?select=id&memo=${like}`);
  for (const p of Array.isArray(purchases.body) ? purchases.body : []) await deletePurchase(api, p.id);
}

export async function remainingOf(api: SandboxApi, purchaseId: string): Promise<{ quantity: number; remaining: number }> {
  const r = await api.rest<{ quantity: number; remaining_quantity: number }[]>(
    `purchase_order_items?select=quantity,remaining_quantity&purchase_order_id=eq.${purchaseId}`,
  );
  return { quantity: Number(r.body[0].quantity), remaining: Number(r.body[0].remaining_quantity) };
}
