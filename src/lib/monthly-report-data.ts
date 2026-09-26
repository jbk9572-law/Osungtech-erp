import { createClient } from "@/lib/supabase/server";
import { getMonthRange, shiftMonth } from "@/lib/date-presets";
import { effectiveMonth } from "@/lib/carryover";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { clusterByDominantPartner } from "@/lib/cluster-by-partner";
import { groupByProductKey } from "@/lib/group-by-product";
import { calcVat } from "@/lib/tax";
import { matchesSearch } from "@/lib/search-match";

// 월별 리포트(reports/monthly, reports/monthly/company)와 엑셀 다운로드가
// 똑같은 집계 로직을 필요로 해서, 화면(JSX)과 분리해 이 파일 하나로
// 모아뒀다 — 두 곳에 각자 복붙해두면 나중에 계산 방식이 바뀔 때(예:
// 이월/반품 처리) 한쪽만 고치고 잊어버리는 사고가 나기 쉽다.

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type View = "product" | "supplier" | "customer";

export type CompanyProductRow = {
  companyId: string;
  companyName: string;
  orderId: string;
  sku: string;
  productName: string;
  spec: string;
  categoryName: string | null;
  unit: string | null;
  quantity: number;
  amount: number;
  taxAmount: number;
};

export type Detail = {
  type: "in" | "out";
  companyId: string;
  companyName: string;
  quantity: number;
  amount: number;
};

export type ItemGroup = {
  productId: string;
  sku: string;
  name: string;
  spec: string;
  categoryName: string | null;
  unit: string | null;
  inQty: number;
  inAmount: number;
  outQty: number;
  outAmount: number;
  details: Detail[];
};

export function buildCompanyGroups(rows: CompanyProductRow[]) {
  return groupByProductKey(
    rows,
    (r) => r.companyId,
    (r) => r.quantity,
    (r) => r.amount,
  )
    .map((g) => ({
      companyId: g.key,
      companyName: g.items[0].companyName,
      totalQuantity: g.totalQuantity,
      totalAmount: g.totalAmount,
      totalTax: g.items.reduce((sum, r) => sum + r.taxAmount, 0),
      transactionCount: new Set(g.items.map((r) => r.orderId)).size,
      products: groupByProductKey(
        g.items,
        (r) => `${r.productName}|${r.spec}`,
        (r) => r.quantity,
        (r) => r.amount,
      ).map((pg) => ({
        ...pg,
        totalTax: pg.items.reduce((sum, r) => sum + r.taxAmount, 0),
        avgUnitPrice: pg.totalQuantity ? pg.totalAmount / pg.totalQuantity : 0,
      })),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function monthOverMonthDelta(current: number, prev: number): { pct: number; isUp: boolean } | null {
  if (!prev) return null;
  const pct = ((current - prev) / prev) * 100;
  return { pct: Math.abs(pct), isUp: pct >= 0 };
}

export type MonthlyReportData = {
  itemGroups: ItemGroup[];
  supplierGroups: ReturnType<typeof buildCompanyGroups>;
  customerGroups: ReturnType<typeof buildCompanyGroups>;
  companyIds: Set<string>;
  companyNameByKey: Map<string, string>;
  totalSalesAmount: number;
  totalPurchaseAmount: number;
  totalInQty: number;
  totalInAmount: number;
  totalOutQty: number;
  totalOutAmount: number;
  salesDelta: { pct: number; isUp: boolean } | null;
  purchaseDelta: { pct: number; isUp: boolean } | null;
  returnReasonStats: { reason: string; count: number; quantity: number; amount: number }[];
  totalReturnAmount: number;
  matchedCompanyKeys: string[];
};

export async function fetchMonthlyReportData(
  supabase: SupabaseServerClient,
  month: string,
  q: string | undefined,
  view: View,
): Promise<MonthlyReportData> {
  const { to } = getMonthRange(month);
  const prevMonth = shiftMonth(month, -1);
  const lookbackMonth = shiftMonth(month, -2);
  const { from: lookbackFrom } = getMonthRange(lookbackMonth);

  const [allSalesRows, allPurchaseRows] = await Promise.all([
    fetchAllRows((from, to2) =>
      supabase
        .from("sales_order_items")
        .select(
          "quantity, unit_price, product_id, sales_orders!inner(id, order_date, is_return, return_reason, is_carryover, customers(id, name)), products(sku, name, spec, unit, categories(name))",
        )
        .gte("sales_orders.order_date", lookbackFrom)
        .lte("sales_orders.order_date", to)
        .order("sales_orders(order_date)", { ascending: true })
        .range(from, to2),
    ),
    fetchAllRows((from, to2) =>
      supabase
        .from("purchase_order_items")
        .select(
          "quantity, unit_cost, product_id, purchase_orders!inner(id, purchase_date, is_carryover, suppliers(id, name)), products(sku, name, spec, unit, categories(name))",
        )
        .gte("purchase_orders.purchase_date", lookbackFrom)
        .lte("purchase_orders.purchase_date", to)
        .order("purchase_orders(purchase_date)", { ascending: true })
        .range(from, to2),
    ),
  ]);

  const salesRows = allSalesRows.filter(
    (r) => effectiveMonth(r.sales_orders?.order_date ?? "", r.sales_orders?.is_carryover ?? false) === month,
  );
  const prevSalesRows = allSalesRows.filter(
    (r) => effectiveMonth(r.sales_orders?.order_date ?? "", r.sales_orders?.is_carryover ?? false) === prevMonth,
  );
  const purchaseRows = allPurchaseRows.filter(
    (r) => effectiveMonth(r.purchase_orders?.purchase_date ?? "", r.purchase_orders?.is_carryover ?? false) === month,
  );
  const prevPurchaseRows = allPurchaseRows.filter(
    (r) => effectiveMonth(r.purchase_orders?.purchase_date ?? "", r.purchase_orders?.is_carryover ?? false) === prevMonth,
  );

  const prevSalesTotal = prevSalesRows.reduce(
    (sum, r) => sum + r.quantity * Number(r.unit_price) * (r.sales_orders?.is_return ? -1 : 1),
    0,
  );
  const prevPurchaseTotal = prevPurchaseRows.reduce((sum, r) => sum + r.quantity * Number(r.unit_cost), 0);

  const groups = new Map<string, ItemGroup>();
  const companyIds = new Set<string>();
  const companyNameByKey = new Map<string, string>();

  function ensureGroup(
    productId: string,
    sku: string,
    name: string,
    spec: string,
    unit: string | null,
    categoryName: string | null,
  ) {
    let group = groups.get(productId);
    if (!group) {
      group = { productId, sku, name, spec, unit, categoryName, inQty: 0, inAmount: 0, outQty: 0, outAmount: 0, details: [] };
      groups.set(productId, group);
    }
    return group;
  }

  for (const row of purchaseRows) {
    if (!row.product_id) continue;
    const supplier = row.purchase_orders?.suppliers;
    const amount = row.quantity * Number(row.unit_cost);
    const group = ensureGroup(
      row.product_id,
      row.products?.sku ?? "-",
      row.products?.name ?? "-",
      row.products?.spec ?? "-",
      row.products?.unit ?? null,
      row.products?.categories?.name ?? null,
    );
    group.inQty += row.quantity;
    group.inAmount += amount;
    if (supplier) {
      const companyKey = `s:${supplier.id}`;
      companyIds.add(companyKey);
      companyNameByKey.set(companyKey, supplier.name);
      const existing = group.details.find((d) => d.type === "in" && d.companyId === supplier.id);
      if (existing) {
        existing.quantity += row.quantity;
        existing.amount += amount;
      } else {
        group.details.push({ type: "in", companyId: supplier.id, companyName: supplier.name, quantity: row.quantity, amount });
      }
    }
  }

  for (const row of salesRows) {
    if (!row.product_id) continue;
    const customer = row.sales_orders?.customers;
    const sign = row.sales_orders?.is_return ? -1 : 1;
    const quantity = row.quantity * sign;
    const amount = row.quantity * Number(row.unit_price) * sign;
    const group = ensureGroup(
      row.product_id,
      row.products?.sku ?? "-",
      row.products?.name ?? "-",
      row.products?.spec ?? "-",
      row.products?.unit ?? null,
      row.products?.categories?.name ?? null,
    );
    group.outQty += quantity;
    group.outAmount += amount;
    if (customer) {
      const companyKey = `c:${customer.id}`;
      companyIds.add(companyKey);
      companyNameByKey.set(companyKey, customer.name);
      const existing = group.details.find((d) => d.type === "out" && d.companyId === customer.id);
      if (existing) {
        existing.quantity += quantity;
        existing.amount += amount;
      } else {
        group.details.push({ type: "out", companyId: customer.id, companyName: customer.name, quantity, amount });
      }
    }
  }

  const keyword = q?.trim().toLowerCase();
  let itemGroups = Array.from(groups.values());
  if (keyword) {
    itemGroups = itemGroups.filter(
      (g) => matchesSearch(keyword, g.sku, g.name, g.spec, g.categoryName) || g.details.some((d) => matchesSearch(keyword, d.companyName)),
    );
  }

  for (const g of itemGroups) {
    g.details.sort((a, b) => {
      if (a.type !== b.type) return a.type === "in" ? -1 : 1;
      return b.amount - a.amount;
    });
  }
  itemGroups = clusterByDominantPartner(
    itemGroups.map((g) => ({
      ...g,
      totalAmount: g.inAmount + g.outAmount,
      outPartners: g.details.filter((d) => d.type === "out").map((d) => ({ id: d.companyId, amount: d.amount })),
    })),
  );

  const purchaseCompanyRows: CompanyProductRow[] = purchaseRows
    .filter((row) => row.purchase_orders?.suppliers)
    .map((row) => {
      const amount = row.quantity * Number(row.unit_cost);
      return {
        companyId: row.purchase_orders!.suppliers!.id,
        companyName: row.purchase_orders!.suppliers!.name,
        orderId: row.purchase_orders!.id,
        sku: row.products?.sku ?? "-",
        productName: row.products?.name ?? "-",
        spec: row.products?.spec ?? "-",
        categoryName: row.products?.categories?.name ?? null,
        unit: row.products?.unit ?? null,
        quantity: row.quantity,
        amount,
        taxAmount: calcVat(amount),
      };
    });
  const salesCompanyRows: CompanyProductRow[] = salesRows
    .filter((row) => row.sales_orders?.customers)
    .map((row) => {
      const sign = row.sales_orders?.is_return ? -1 : 1;
      const supplyAmount = row.quantity * Number(row.unit_price);
      const amount = supplyAmount * sign;
      return {
        companyId: row.sales_orders!.customers!.id,
        companyName: row.sales_orders!.customers!.name,
        orderId: row.sales_orders!.id,
        sku: row.products?.sku ?? "-",
        productName: row.products?.name ?? "-",
        spec: row.products?.spec ?? "-",
        categoryName: row.products?.categories?.name ?? null,
        unit: row.products?.unit ?? null,
        quantity: row.quantity * sign,
        amount,
        taxAmount: calcVat(supplyAmount) * sign,
      };
    });

  const purchaseCompanyRowsFiltered = keyword
    ? purchaseCompanyRows.filter((r) => matchesSearch(keyword, r.sku, r.productName, r.spec, r.categoryName, r.companyName))
    : purchaseCompanyRows;
  const salesCompanyRowsFiltered = keyword
    ? salesCompanyRows.filter((r) => matchesSearch(keyword, r.sku, r.productName, r.spec, r.categoryName, r.companyName))
    : salesCompanyRows;
  const supplierGroups = view === "supplier" ? buildCompanyGroups(purchaseCompanyRowsFiltered) : [];
  const customerGroups = view === "customer" ? buildCompanyGroups(salesCompanyRowsFiltered) : [];

  const matchedCompanyKeys = keyword
    ? Array.from(companyNameByKey.keys()).filter((key) => (companyNameByKey.get(key) ?? "").toLowerCase().includes(keyword))
    : [];

  const totalSalesAmount = itemGroups.reduce((sum, g) => sum + g.outAmount, 0);
  const totalPurchaseAmount = itemGroups.reduce((sum, g) => sum + g.inAmount, 0);
  const totalInQty = itemGroups.reduce((sum, g) => sum + g.inQty, 0);
  const totalInAmount = itemGroups.reduce((sum, g) => sum + g.inAmount, 0);
  const totalOutQty = itemGroups.reduce((sum, g) => sum + g.outQty, 0);
  const totalOutAmount = itemGroups.reduce((sum, g) => sum + g.outAmount, 0);

  const salesDelta = monthOverMonthDelta(totalSalesAmount, prevSalesTotal);
  const purchaseDelta = monthOverMonthDelta(totalPurchaseAmount, prevPurchaseTotal);

  const returnReasonMap = new Map<string, { orderIds: Set<string>; quantity: number; amount: number }>();
  for (const row of salesRows) {
    if (!row.sales_orders?.is_return) continue;
    const reason = row.sales_orders.return_reason || "미지정";
    const entry = returnReasonMap.get(reason) ?? { orderIds: new Set<string>(), quantity: 0, amount: 0 };
    entry.orderIds.add(row.sales_orders.id);
    entry.quantity += row.quantity;
    entry.amount += row.quantity * Number(row.unit_price);
    returnReasonMap.set(reason, entry);
  }
  const returnReasonStats = Array.from(returnReasonMap.entries())
    .map(([reason, e]) => ({ reason, count: e.orderIds.size, quantity: e.quantity, amount: e.amount }))
    .sort((a, b) => b.amount - a.amount);
  const totalReturnAmount = returnReasonStats.reduce((sum, r) => sum + r.amount, 0);

  return {
    itemGroups,
    supplierGroups,
    customerGroups,
    companyIds,
    companyNameByKey,
    totalSalesAmount,
    totalPurchaseAmount,
    totalInQty,
    totalInAmount,
    totalOutQty,
    totalOutAmount,
    salesDelta,
    purchaseDelta,
    returnReasonStats,
    totalReturnAmount,
    matchedCompanyKeys,
  };
}
