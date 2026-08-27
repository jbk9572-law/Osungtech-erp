import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { currentMonth, getMonthRange, shiftMonth } from "@/lib/date-presets";
import { GridBadge } from "@/components/grid/badge";
import { clusterByDominantPartner } from "@/lib/cluster-by-partner";
import { groupByProductKey } from "@/lib/group-by-product";

type View = "product" | "supplier" | "customer";

type CompanyProductRow = {
  companyId: string;
  companyName: string;
  orderId: string;
  sku: string;
  productName: string;
  spec: string;
  unit: string | null;
  quantity: number;
  amount: number;
  taxAmount: number;
};

function matchesKeyword(row: CompanyProductRow, keyword: string): boolean {
  return (
    row.sku.toLowerCase().includes(keyword) ||
    row.productName.toLowerCase().includes(keyword) ||
    row.spec.toLowerCase().includes(keyword) ||
    row.companyName.toLowerCase().includes(keyword)
  );
}

// 매입처별/매출처별 보기 — 거래처를 먼저 묶고 그 안에서 품목별 소계를
// 낸다. 품목별 보기(ItemGroup)와 반대 방향으로 같은 데이터를 한 번 더
// 묶는 것이라, 이미 있는 groupByProductKey를 두 단계(거래처 → 품목)로
// 재사용한다.
function buildCompanyGroups(rows: CompanyProductRow[]) {
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

// 전월 대비 증감률 — 전월 실적이 0이면(신규 시작 등) 비율 계산이 무의미해
// 배지를 아예 표시하지 않는다.
function monthOverMonthDelta(
  current: number,
  prev: number,
): { pct: number; isUp: boolean } | null {
  if (!prev) return null;
  const pct = ((current - prev) / prev) * 100;
  return { pct: Math.abs(pct), isUp: pct >= 0 };
}

type Detail = {
  type: "in" | "out";
  companyId: string;
  companyName: string;
  quantity: number;
  amount: number;
};

type ItemGroup = {
  productId: string;
  sku: string;
  name: string;
  spec: string;
  unit: string | null;
  inQty: number;
  inAmount: number;
  outQty: number;
  outAmount: number;
  details: Detail[];
};

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; q?: string; view?: string }>;
}) {
  const { month: monthParam, q, view: viewParam } = await searchParams;
  const view: View =
    viewParam === "supplier" || viewParam === "customer"
      ? viewParam
      : "product";
  const month = monthParam || currentMonth();
  const { from, to } = getMonthRange(month);
  const prevMonth = shiftMonth(month, -1);
  const { from: prevFrom, to: prevTo } = getMonthRange(prevMonth);
  const supabase = await createClient();

  // limit 없이 order()만 걸면 postgrest가 기본 상한(1000행)에서 조용히
  // 자르고, order() 없이 limit만 걸면 어떤 행이 잘리는지 보장이 안 된다
  // (한 달 거래가 한도를 넘으면 매번 다른 행이 빠지면서 합계가 틀어질 수
  // 있다). 월 집계는 정확도가 중요해서 넉넉한 상한(5000) + 결정적인
  // 정렬을 같이 건다.
  const [
    { data: salesRows },
    { data: purchaseRows },
    { data: prevSalesRows },
    { data: prevPurchaseRows },
  ] = await Promise.all([
    supabase
      .from("sales_order_items")
      .select(
        "quantity, unit_price, product_id, sales_orders!inner(id, order_date, customers(id, name)), products(sku, name, spec, unit)",
      )
      .gte("sales_orders.order_date", from)
      .lte("sales_orders.order_date", to)
      .order("sales_orders(order_date)", { ascending: true })
      .limit(5000),
    supabase
      .from("purchase_order_items")
      .select(
        "quantity, unit_cost, product_id, purchase_orders!inner(id, purchase_date, suppliers(id, name)), products(sku, name, spec, unit)",
      )
      .gte("purchase_orders.purchase_date", from)
      .lte("purchase_orders.purchase_date", to)
      .order("purchase_orders(purchase_date)", { ascending: true })
      .limit(5000),
    // 요약카드의 전월 대비 증감(%) 계산용 — 품목/거래처 상세는 필요 없고
    // 총액만 필요하므로 가벼운 컬럼만 가져온다.
    supabase
      .from("sales_order_items")
      .select("quantity, unit_price, sales_orders!inner(order_date)")
      .gte("sales_orders.order_date", prevFrom)
      .lte("sales_orders.order_date", prevTo)
      .limit(5000),
    supabase
      .from("purchase_order_items")
      .select("quantity, unit_cost, purchase_orders!inner(purchase_date)")
      .gte("purchase_orders.purchase_date", prevFrom)
      .lte("purchase_orders.purchase_date", prevTo)
      .limit(5000),
  ]);

  const prevSalesTotal = (prevSalesRows ?? []).reduce(
    (sum, r) => sum + r.quantity * Number(r.unit_price),
    0,
  );
  const prevPurchaseTotal = (prevPurchaseRows ?? []).reduce(
    (sum, r) => sum + r.quantity * Number(r.unit_cost),
    0,
  );

  const groups = new Map<string, ItemGroup>();
  const companyIds = new Set<string>();
  const companyNameByKey = new Map<string, string>();

  function ensureGroup(
    productId: string,
    sku: string,
    name: string,
    spec: string,
    unit: string | null,
  ) {
    let group = groups.get(productId);
    if (!group) {
      group = {
        productId,
        sku,
        name,
        spec,
        unit,
        inQty: 0,
        inAmount: 0,
        outQty: 0,
        outAmount: 0,
        details: [],
      };
      groups.set(productId, group);
    }
    return group;
  }

  for (const row of purchaseRows ?? []) {
    const supplier = row.purchase_orders?.suppliers;
    const amount = row.quantity * Number(row.unit_cost);
    const sku = row.products?.sku ?? "-";
    const productName = row.products?.name ?? "-";
    const spec = row.products?.spec ?? "-";
    const unit = row.products?.unit ?? null;
    const group = ensureGroup(row.product_id, sku, productName, spec, unit);
    group.inQty += row.quantity;
    group.inAmount += amount;
    if (supplier) {
      const companyKey = `s:${supplier.id}`;
      companyIds.add(companyKey);
      companyNameByKey.set(companyKey, supplier.name);
      const existing = group.details.find(
        (d) => d.type === "in" && d.companyId === supplier.id,
      );
      if (existing) {
        existing.quantity += row.quantity;
        existing.amount += amount;
      } else {
        group.details.push({
          type: "in",
          companyId: supplier.id,
          companyName: supplier.name,
          quantity: row.quantity,
          amount,
        });
      }
    }
  }

  for (const row of salesRows ?? []) {
    const customer = row.sales_orders?.customers;
    const amount = row.quantity * Number(row.unit_price);
    const sku = row.products?.sku ?? "-";
    const productName = row.products?.name ?? "-";
    const spec = row.products?.spec ?? "-";
    const unit = row.products?.unit ?? null;
    const group = ensureGroup(row.product_id, sku, productName, spec, unit);
    group.outQty += row.quantity;
    group.outAmount += amount;
    if (customer) {
      const companyKey = `c:${customer.id}`;
      companyIds.add(companyKey);
      companyNameByKey.set(companyKey, customer.name);
      const existing = group.details.find(
        (d) => d.type === "out" && d.companyId === customer.id,
      );
      if (existing) {
        existing.quantity += row.quantity;
        existing.amount += amount;
      } else {
        group.details.push({
          type: "out",
          companyId: customer.id,
          companyName: customer.name,
          quantity: row.quantity,
          amount,
        });
      }
    }
  }

  const keyword = q?.trim().toLowerCase();
  let itemGroups = Array.from(groups.values());
  if (keyword) {
    itemGroups = itemGroups.filter(
      (g) =>
        g.sku.toLowerCase().includes(keyword) ||
        g.name.toLowerCase().includes(keyword) ||
        g.spec.toLowerCase().includes(keyword) ||
        g.details.some((d) => d.companyName.toLowerCase().includes(keyword)),
    );
  }

  for (const g of itemGroups) {
    g.details.sort((a, b) => {
      if (a.type !== b.type) return a.type === "in" ? -1 : 1;
      return b.amount - a.amount;
    });
  }
  // 품목 하나의 거래금액 순으로만 정렬하면, 같은 출고처로 나가는 품목끼리도
  // 다른 품목을 사이에 두고 떨어져 보인다("KD238VA-R3"와 "KD240BI"가 둘 다
  // 신일베스텍으로 나가는데 목록에서 멀리 떨어지는 식). 품목마다 제일 비중
  // 큰 출고처를 기준으로 묶어서, 같은 출고처가 주력인 품목들이 붙어
  // 나오게 한다.
  itemGroups = clusterByDominantPartner(
    itemGroups.map((g) => ({
      ...g,
      totalAmount: g.inAmount + g.outAmount,
      outPartners: g.details
        .filter((d) => d.type === "out")
        .map((d) => ({ id: d.companyId, amount: d.amount })),
    })),
  );

  // 매입처별/매출처별 보기용 — 위에서 이미 받아온 원본 행을 거래처 기준으로
  // 다시 정리한다. 새로 쿼리하지 않고 같은 데이터를 재사용한다.
  const purchaseCompanyRows: CompanyProductRow[] = (purchaseRows ?? [])
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
        unit: row.products?.unit ?? null,
        quantity: row.quantity,
        amount,
        taxAmount: Math.round(amount * 0.1),
      };
    });
  const salesCompanyRows: CompanyProductRow[] = (salesRows ?? [])
    .filter((row) => row.sales_orders?.customers)
    .map((row) => {
      const amount = row.quantity * Number(row.unit_price);
      return {
        companyId: row.sales_orders!.customers!.id,
        companyName: row.sales_orders!.customers!.name,
        orderId: row.sales_orders!.id,
        sku: row.products?.sku ?? "-",
        productName: row.products?.name ?? "-",
        spec: row.products?.spec ?? "-",
        unit: row.products?.unit ?? null,
        quantity: row.quantity,
        amount,
        taxAmount: Math.round(amount * 0.1),
      };
    });

  const supplierGroups =
    view === "supplier"
      ? buildCompanyGroups(
          keyword
            ? purchaseCompanyRows.filter((r) => matchesKeyword(r, keyword))
            : purchaseCompanyRows,
        )
      : [];
  const customerGroups =
    view === "customer"
      ? buildCompanyGroups(
          keyword
            ? salesCompanyRows.filter((r) => matchesKeyword(r, keyword))
            : salesCompanyRows,
        )
      : [];
  const companyGroups = view === "supplier" ? supplierGroups : customerGroups;
  const companyKeyPrefix = view === "supplier" ? "s" : "c";

  // 검색어가 거래처 하나로 정확히 특정될 때(여러 거래처가 매칭되면 어느
  // 거래처인지 모호하므로 생략), 요약표를 길게 늘어놓는 대신 그 거래처의
  // 일자별 상세내역만 보여주는 별도 페이지로 바로 이동시킨다.
  if (keyword) {
    const matchedKeys = Array.from(companyNameByKey.keys()).filter((key) =>
      (companyNameByKey.get(key) ?? "").toLowerCase().includes(keyword),
    );
    if (matchedKeys.length === 1) {
      redirect(
        `/reports/monthly/company?month=${month}&company=${encodeURIComponent(matchedKeys[0])}`,
      );
    }
  }

  const totalSalesAmount = itemGroups.reduce((sum, g) => sum + g.outAmount, 0);
  const totalPurchaseAmount = itemGroups.reduce(
    (sum, g) => sum + g.inAmount,
    0,
  );
  const totalInQty = itemGroups.reduce((sum, g) => sum + g.inQty, 0);
  const totalInAmount = itemGroups.reduce((sum, g) => sum + g.inAmount, 0);
  const totalOutQty = itemGroups.reduce((sum, g) => sum + g.outQty, 0);
  const totalOutAmount = itemGroups.reduce((sum, g) => sum + g.outAmount, 0);

  const salesDelta = monthOverMonthDelta(totalSalesAmount, prevSalesTotal);
  const purchaseDelta = monthOverMonthDelta(
    totalPurchaseAmount,
    prevPurchaseTotal,
  );

  const [year, monthNum] = month.split("-");
  const nextMonth = shiftMonth(month, 1);
  const thisMonth = currentMonth();
  const qSuffix = q ? `&q=${encodeURIComponent(q)}` : "";
  const viewSuffix = view !== "product" ? `&view=${view}` : "";
  const suffix = `${qSuffix}${viewSuffix}`;

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F5: { submitFormSelector: "#monthly-report-search-form" },
          Escape: { href: "/dashboard" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">
        확장모듈 &gt; 월별 리포트
      </h1>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        <Link
          href={`/reports/monthly?month=${prevMonth}${suffix}`}
          className="erp-date-preset-btn"
        >
          ◀ 이전달
        </Link>
        <Link
          href={`/reports/monthly?month=${thisMonth}${suffix}`}
          className={`erp-date-preset-btn${month === thisMonth ? " active" : ""}`}
        >
          이번달
        </Link>
        <Link
          href={`/reports/monthly?month=${nextMonth}${suffix}`}
          className="erp-date-preset-btn"
        >
          다음달 ▶
        </Link>
      </div>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        <Link
          href={`/reports/monthly?month=${month}${qSuffix}`}
          className={`erp-date-preset-btn${view === "product" ? " active" : ""}`}
        >
          품목별
        </Link>
        <Link
          href={`/reports/monthly?month=${month}${qSuffix}&view=supplier`}
          className={`erp-date-preset-btn${view === "supplier" ? " active" : ""}`}
        >
          매입처별
        </Link>
        <Link
          href={`/reports/monthly?month=${month}${qSuffix}&view=customer`}
          className={`erp-date-preset-btn${view === "customer" ? " active" : ""}`}
        >
          매출처별
        </Link>
      </div>

      <form method="get" id="monthly-report-search-form" className="erp-search">
        <input type="hidden" name="view" value={view} />
        <div className="erp-field">
          <label htmlFor="search-month">기준월</label>
          <input
            id="search-month"
            type="month"
            name="month"
            defaultValue={month}
            className="erp-input"
          />
        </div>
        <div className="erp-field" style={{ minWidth: 240, flex: 1 }}>
          <label htmlFor="search-q">품목 / 거래처 검색</label>
          <input
            id="search-q"
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="품목명, SKU, 규격, 거래처명"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {q && (
          <Link
            href={`/reports/monthly?month=${month}${viewSuffix}`}
            className="erp-btn"
          >
            초기화
          </Link>
        )}
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </form>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--erp-text-muted)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            {year}년 {Number(monthNum)}월 매출액
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {totalSalesAmount.toLocaleString()}원
          </div>
          {salesDelta && (
            <div
              style={{
                marginTop: 5,
                fontSize: 11,
                fontWeight: 700,
                color: salesDelta.isUp
                  ? "var(--erp-success)"
                  : "var(--erp-danger)",
              }}
            >
              {salesDelta.isUp ? "▲" : "▼"} {salesDelta.pct.toFixed(1)}%{" "}
              <span
                style={{ fontWeight: 500, color: "var(--erp-text-muted)" }}
              >
                전월대비
              </span>
            </div>
          )}
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--erp-text-muted)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            {year}년 {Number(monthNum)}월 매입액
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {totalPurchaseAmount.toLocaleString()}원
          </div>
          {purchaseDelta && (
            <div
              style={{
                marginTop: 5,
                fontSize: 11,
                fontWeight: 700,
                color: purchaseDelta.isUp
                  ? "var(--erp-success)"
                  : "var(--erp-danger)",
              }}
            >
              {purchaseDelta.isUp ? "▲" : "▼"} {purchaseDelta.pct.toFixed(1)}%{" "}
              <span
                style={{ fontWeight: 500, color: "var(--erp-text-muted)" }}
              >
                전월대비
              </span>
            </div>
          )}
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--erp-text-muted)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            거래 품목 수
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {itemGroups.length.toLocaleString()}개
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--erp-text-muted)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            거래처 수
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {companyIds.size.toLocaleString()}곳
          </div>
        </div>
      </div>

      {view === "product" && (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>품목 / 거래처</th>
                <th style={{ width: 70 }}>구분</th>
                <th className="num" style={{ width: 110 }}>
                  입고수량
                </th>
                <th className="num" style={{ width: 120 }}>
                  입고금액
                </th>
                <th className="num" style={{ width: 110 }}>
                  출고수량
                </th>
                <th className="num" style={{ width: 120 }}>
                  출고금액
                </th>
                <th className="num" style={{ width: 110 }}>
                  재고 순증감
                </th>
              </tr>
            </thead>
            <tbody>
              {itemGroups.map((g, groupIndex) => {
                // 품목(헤더+거래처별 상세행)을 한 덩어리로 보고, 덩어리마다
                // 번갈아 배경을 넣는다 — 표 전체에 걸리는 일반 zebra(짝수행
                // 음영)는 품목마다 상세행 수가 달라서 경계가 안 맞고 오히려
                // 헷갈렸다.
                const groupBg =
                  groupIndex % 2 === 0 ? "#ffffff" : "var(--erp-bg)";
                return (
                  <Fragment key={g.productId}>
                    <tr style={{ background: groupBg }}>
                      <td style={{ fontWeight: 700 }}>
                        {g.sku !== "-" && (
                          <span
                            style={{
                              color: "var(--erp-text-muted)",
                              fontWeight: 400,
                            }}
                          >
                            {g.sku} ·{" "}
                          </span>
                        )}
                        {g.name}
                        {g.spec !== "-" && (
                          <span
                            style={{
                              color: "var(--erp-text-muted)",
                              fontWeight: 400,
                            }}
                          >
                            {" "}
                            ({g.spec})
                          </span>
                        )}
                      </td>
                      <td />
                      <td className="num" style={{ fontWeight: 700 }}>
                        {g.inQty.toLocaleString()} {g.unit}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {g.inAmount.toLocaleString()}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {g.outQty.toLocaleString()} {g.unit}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {g.outAmount.toLocaleString()}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {(g.inQty - g.outQty).toLocaleString()} {g.unit}
                      </td>
                    </tr>
                    {g.details.map((d) => (
                      <tr
                        key={`${g.productId}-${d.type}-${d.companyId}`}
                        style={{ background: groupBg }}
                      >
                        <td style={{ paddingLeft: 26 }}>
                          <Link
                            href={`/reports/monthly/company?month=${month}&company=${encodeURIComponent(
                              d.type === "in"
                                ? `s:${d.companyId}`
                                : `c:${d.companyId}`,
                            )}`}
                            style={{
                              color: "var(--erp-text-muted)",
                              textDecoration: "underline",
                            }}
                          >
                            {d.companyName}
                          </Link>
                        </td>
                        <td>
                          <GridBadge tone={d.type === "in" ? "ok" : "danger"}>
                            {d.type === "in" ? "입고" : "출고"}
                          </GridBadge>
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          {d.type === "in"
                            ? `${d.quantity.toLocaleString()} ${g.unit ?? ""}`
                            : "-"}
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          {d.type === "in" ? d.amount.toLocaleString() : "-"}
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          {d.type === "out"
                            ? `${d.quantity.toLocaleString()} ${g.unit ?? ""}`
                            : "-"}
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          {d.type === "out" ? d.amount.toLocaleString() : "-"}
                        </td>
                        <td
                          className="num"
                          style={{ color: "var(--erp-text-muted)" }}
                        >
                          -
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {!itemGroups.length && (
                <tr>
                  <td colSpan={7} className="erp-grid-empty">
                    조건에 맞는 입출고 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
            {itemGroups.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
                  <td colSpan={2} className="erp-grid-sticky-label">
                    합계 ({itemGroups.length}개 품목)
                  </td>
                  <td className="num">{totalInQty.toLocaleString()}</td>
                  <td className="num">{totalInAmount.toLocaleString()}</td>
                  <td className="num">{totalOutQty.toLocaleString()}</td>
                  <td className="num">{totalOutAmount.toLocaleString()}</td>
                  <td className="num">
                    {(totalInQty - totalOutQty).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {(view === "supplier" || view === "customer") && (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>{view === "supplier" ? "매입처" : "매출처"} / 품목</th>
                <th style={{ width: 150 }}>규격</th>
                <th className="num" style={{ width: 90 }}>
                  수량
                </th>
                <th
                  className="num"
                  style={{ width: 70 }}
                  title="품목 종류 수가 아니라, 이 거래처와 거래한 전표(주문) 건수입니다."
                >
                  전표수
                </th>
                <th className="num" style={{ width: 100 }}>
                  평균단가
                </th>
                <th className="num" style={{ width: 110 }}>
                  금액
                </th>
                <th className="num" style={{ width: 100 }}>
                  세액
                </th>
                <th className="num" style={{ width: 80 }}>
                  비중
                </th>
              </tr>
            </thead>
            <tbody>
              {companyGroups.map((cg, groupIndex) => {
                const groupBg =
                  groupIndex % 2 === 0 ? "#ffffff" : "var(--erp-bg)";
                const rank = groupIndex + 1;
                const rankStyle =
                  rank === 1
                    ? { background: "var(--erp-primary)", color: "#fff" }
                    : rank === 2
                      ? {
                          background: "var(--erp-selected)",
                          color: "var(--erp-primary)",
                        }
                      : {
                          background: "#eef0f3",
                          color: "var(--erp-text-muted)",
                        };
                const grandTotal =
                  view === "supplier" ? totalPurchaseAmount : totalSalesAmount;
                const share = grandTotal ? (cg.totalAmount / grandTotal) * 100 : 0;
                return (
                  <Fragment key={cg.companyId}>
                    <tr style={{ background: groupBg }}>
                      <td colSpan={2} style={{ fontWeight: 700 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              fontSize: 11,
                              fontWeight: 800,
                              flexShrink: 0,
                              ...rankStyle,
                            }}
                          >
                            {rank}
                          </span>
                          <Link
                            href={`/reports/monthly/company?month=${month}&company=${encodeURIComponent(
                              `${companyKeyPrefix}:${cg.companyId}`,
                            )}`}
                            style={{ color: "var(--erp-text)" }}
                          >
                            {cg.companyName}
                          </Link>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 4,
                            marginLeft: 28,
                            maxWidth: 200,
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: 5,
                              borderRadius: 999,
                              background: "var(--erp-divider)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: 999,
                                background: "var(--erp-primary)",
                                width: `${Math.min(share, 100)}%`,
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--erp-primary)",
                              minWidth: 34,
                              textAlign: "right",
                            }}
                          >
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {cg.totalQuantity.toLocaleString()}
                      </td>
                      <td className="num">
                        <GridBadge tone="info">
                          {cg.transactionCount}건
                        </GridBadge>
                      </td>
                      <td
                        className="num"
                        style={{ color: "var(--erp-text-muted)" }}
                      >
                        -
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {cg.totalAmount.toLocaleString()}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {cg.totalTax.toLocaleString()}
                      </td>
                      <td
                        className="num"
                        style={{ fontWeight: 700, color: "var(--erp-primary)" }}
                      >
                        {share.toFixed(1)}%
                      </td>
                    </tr>
                    {cg.products.map((pg) => {
                      const first = pg.items[0];
                      return (
                        <tr
                          key={`${cg.companyId}-${pg.key}`}
                          style={{ background: groupBg }}
                        >
                          <td
                            style={{
                              paddingLeft: 34,
                              color: "var(--erp-text-muted)",
                            }}
                          >
                            {first.sku !== "-" && <span>{first.sku} · </span>}
                            {first.productName}
                          </td>
                          <td style={{ color: "var(--erp-text-muted)" }}>
                            {first.spec !== "-" ? first.spec : "-"}
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            {pg.totalQuantity.toLocaleString()} {first.unit}
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            -
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            {Math.round(pg.avgUnitPrice).toLocaleString()}
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            {pg.totalAmount.toLocaleString()}
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            {pg.totalTax.toLocaleString()}
                          </td>
                          <td
                            className="num"
                            style={{ color: "var(--erp-text-muted)" }}
                          >
                            -
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
              {!companyGroups.length && (
                <tr>
                  <td colSpan={8} className="erp-grid-empty">
                    조건에 맞는 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
            {companyGroups.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--erp-bg)", fontWeight: 700 }}>
                  <td colSpan={2} className="erp-grid-sticky-label">
                    합계 ({companyGroups.length}곳)
                  </td>
                  <td className="num">
                    {companyGroups
                      .reduce((sum, g) => sum + g.totalQuantity, 0)
                      .toLocaleString()}
                  </td>
                  <td className="num">
                    {companyGroups
                      .reduce((sum, g) => sum + g.transactionCount, 0)
                      .toLocaleString()}
                    건
                  </td>
                  <td className="num">-</td>
                  <td className="num">
                    {companyGroups
                      .reduce((sum, g) => sum + g.totalAmount, 0)
                      .toLocaleString()}
                  </td>
                  <td className="num">
                    {companyGroups
                      .reduce((sum, g) => sum + g.totalTax, 0)
                      .toLocaleString()}
                  </td>
                  <td className="num">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
