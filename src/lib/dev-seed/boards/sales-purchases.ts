import type { ActingSession, BoardSeedResult, SeedContext } from "../types";
import { pick } from "../korean-data";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function randomItems(ctx: SeedContext, count: number) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const product = pick(ctx.products);
    items.push({ product, quantity: 1 + Math.floor(Math.random() * 20) });
  }
  return items;
}

export async function seedSales(ctx: SeedContext, actors: ActingSession[], count: number): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const customer = pick(ctx.customers);
    const items = randomItems(ctx, 1 + Math.floor(Math.random() * 3));
    const { error } = await actor.client.rpc("create_sale_with_items", {
      p_customer_id: customer.id,
      p_warehouse_id: ctx.warehouseId,
      p_order_date: todayStr(),
      p_memo: "테스트용 더미 매출 전표",
      p_created_by: actor.employee.id,
      p_items: items.map(({ product, quantity }) => ({
        productId: product.id,
        customName: null,
        spec: product.spec,
        quantity,
        unitPrice: product.price,
        remark: null,
        lotNumber: null,
      })),
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "매출(sales)", created, error: lastError };
}

export async function seedPurchases(ctx: SeedContext, actors: ActingSession[], count: number): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const supplier = pick(ctx.suppliers);
    const items = randomItems(ctx, 1 + Math.floor(Math.random() * 3));
    const { error } = await actor.client.rpc("create_purchase_with_items", {
      p_supplier_id: supplier.id,
      p_warehouse_id: ctx.warehouseId,
      p_purchase_date: todayStr(),
      p_memo: "테스트용 더미 매입 전표",
      p_created_by: actor.employee.id,
      p_items: items.map(({ product, quantity }) => ({
        productId: product.id,
        spec: product.spec,
        quantity,
        unitCost: product.cost,
        remark: null,
        lotNumber: null,
      })),
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "매입(purchases)", created, error: lastError };
}

export async function seedQuotes(ctx: SeedContext, actors: ActingSession[], count: number): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const customer = pick(ctx.customers);
    const items = randomItems(ctx, 1 + Math.floor(Math.random() * 3));
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    const { error } = await actor.client.rpc("create_quote_with_items", {
      p_customer_id: customer.id,
      p_quote_date: todayStr(),
      p_valid_until: validUntil.toISOString().slice(0, 10),
      p_memo: "테스트용 더미 견적서",
      p_items: items.map(({ product, quantity }) => ({
        productId: product.id,
        spec: product.spec,
        quantity,
        unitPrice: product.price,
        remark: null,
      })),
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "견적서관리(quotes)", created, error: lastError };
}

export async function seedPurchaseRequests(
  ctx: SeedContext,
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const supplier = pick(ctx.suppliers);
    const items = randomItems(ctx, 1 + Math.floor(Math.random() * 3));
    const { error } = await actor.client.rpc("create_purchase_request_with_items", {
      p_supplier_id: supplier.id,
      p_request_date: todayStr(),
      p_memo: "테스트용 더미 구매요청",
      p_items: items.map(({ product, quantity }) => ({
        productId: product.id,
        spec: product.spec,
        quantity,
        estimatedUnitPrice: product.cost,
        remark: null,
      })),
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "구매요청(purchase-requests)", created, error: lastError };
}

export async function seedPurchaseQuoteRequests(
  ctx: SeedContext,
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const supplierIds = ctx.suppliers
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(2, ctx.suppliers.length))
      .map((s) => s.id);
    const items = randomItems(ctx, 1 + Math.floor(Math.random() * 3));
    const { error } = await actor.client.rpc("create_purchase_quote_request_with_items", {
      p_supplier_ids: supplierIds,
      p_request_date: todayStr(),
      p_memo: "테스트용 더미 구매 견적요청",
      p_items: items.map(({ product, quantity }) => ({
        productId: product.id,
        spec: product.spec,
        quantity,
        remark: null,
      })),
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "구매 견적요청(purchase-quote-requests)", created, error: lastError };
}

export async function seedPaymentRequests(
  ctx: SeedContext,
  actors: ActingSession[],
  count: number,
): Promise<BoardSeedResult> {
  let created = 0;
  let lastError: string | undefined;
  const cardTypes = ["법인카드", "현금"];
  for (let i = 0; i < count; i++) {
    const actor = pick(actors);
    const department = actor.employee.departmentId
      ? ctx.departments.find((d) => d.id === actor.employee.departmentId)?.name
      : pick(ctx.departments)?.name;
    const lineItems = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, (_, idx) => ({
      usedAt: todayStr(),
      vendor: `${pick(ctx.suppliers)?.name ?? "테스트 거래처"}`,
      purpose: "테스트용 더미 지출",
      amount: 10000 + Math.floor(Math.random() * 200000),
      remark: null,
      sortOrder: idx,
      isHighlighted: false,
    }));
    const { error } = await actor.client.rpc("create_payment_request_with_items", {
      p_department: department ?? null,
      p_period_from: todayStr(),
      p_period_to: todayStr(),
      p_card_type: pick(cardTypes),
      p_requested_by: actor.employee.id,
      p_items: lineItems,
    });
    if (error) lastError = error.message;
    else created++;
  }
  return { board: "지급결의양식(payment-requests)", created, error: lastError };
}
