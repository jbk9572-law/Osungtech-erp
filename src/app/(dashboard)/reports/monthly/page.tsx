import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { currentMonth, getMonthRange, shiftMonth } from "@/lib/date-presets";

type Detail = {
  type: "in" | "out";
  companyId: string;
  companyName: string;
  quantity: number;
  amount: number;
};

type ItemGroup = {
  productId: string;
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
  searchParams: Promise<{ month?: string; q?: string }>;
}) {
  const { month: monthParam, q } = await searchParams;
  const month = monthParam || currentMonth();
  const { from, to } = getMonthRange(month);
  const supabase = await createClient();

  // limit 없이 order()만 걸면 postgrest가 기본 상한(1000행)에서 조용히
  // 자르고, order() 없이 limit만 걸면 어떤 행이 잘리는지 보장이 안 된다
  // (한 달 거래가 한도를 넘으면 매번 다른 행이 빠지면서 합계가 틀어질 수
  // 있다). 월 집계는 정확도가 중요해서 넉넉한 상한(5000) + 결정적인
  // 정렬을 같이 건다.
  const [{ data: salesRows }, { data: purchaseRows }] = await Promise.all([
    supabase
      .from("sales_order_items")
      .select(
        "quantity, unit_price, product_id, sales_orders!inner(order_date, customers(id, name)), products(name, spec, unit)"
      )
      .gte("sales_orders.order_date", from)
      .lte("sales_orders.order_date", to)
      .order("sales_orders(order_date)", { ascending: true })
      .limit(5000),
    supabase
      .from("purchase_order_items")
      .select(
        "quantity, unit_cost, product_id, purchase_orders!inner(purchase_date, suppliers(id, name)), products(name, spec, unit)"
      )
      .gte("purchase_orders.purchase_date", from)
      .lte("purchase_orders.purchase_date", to)
      .order("purchase_orders(purchase_date)", { ascending: true })
      .limit(5000),
  ]);

  const groups = new Map<string, ItemGroup>();
  const companyIds = new Set<string>();
  const companyNameByKey = new Map<string, string>();

  function ensureGroup(productId: string, name: string, spec: string, unit: string | null) {
    let group = groups.get(productId);
    if (!group) {
      group = { productId, name, spec, unit, inQty: 0, inAmount: 0, outQty: 0, outAmount: 0, details: [] };
      groups.set(productId, group);
    }
    return group;
  }

  for (const row of purchaseRows ?? []) {
    const supplier = row.purchase_orders?.suppliers;
    const amount = row.quantity * Number(row.unit_cost);
    const productName = row.products?.name ?? "-";
    const spec = row.products?.spec ?? "-";
    const unit = row.products?.unit ?? null;
    const group = ensureGroup(row.product_id, productName, spec, unit);
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
    const productName = row.products?.name ?? "-";
    const spec = row.products?.spec ?? "-";
    const unit = row.products?.unit ?? null;
    const group = ensureGroup(row.product_id, productName, spec, unit);
    group.outQty += row.quantity;
    group.outAmount += amount;
    if (customer) {
      const companyKey = `c:${customer.id}`;
      companyIds.add(companyKey);
      companyNameByKey.set(companyKey, customer.name);
      const existing = group.details.find((d) => d.type === "out" && d.companyId === customer.id);
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
        g.name.toLowerCase().includes(keyword) ||
        g.spec.toLowerCase().includes(keyword) ||
        g.details.some((d) => d.companyName.toLowerCase().includes(keyword))
    );
  }

  itemGroups.sort((a, b) => b.inAmount + b.outAmount - (a.inAmount + a.outAmount));
  for (const g of itemGroups) {
    g.details.sort((a, b) => {
      if (a.type !== b.type) return a.type === "in" ? -1 : 1;
      return b.amount - a.amount;
    });
  }

  // 검색어가 거래처 하나로 정확히 특정될 때(여러 거래처가 매칭되면 어느
  // 거래처인지 모호하므로 생략), 요약표를 길게 늘어놓는 대신 그 거래처의
  // 일자별 상세내역만 보여주는 별도 페이지로 바로 이동시킨다.
  if (keyword) {
    const matchedKeys = Array.from(companyNameByKey.keys()).filter((key) =>
      (companyNameByKey.get(key) ?? "").toLowerCase().includes(keyword)
    );
    if (matchedKeys.length === 1) {
      redirect(`/reports/monthly/company?month=${month}&company=${encodeURIComponent(matchedKeys[0])}`);
    }
  }

  const totalSalesAmount = itemGroups.reduce((sum, g) => sum + g.outAmount, 0);
  const totalPurchaseAmount = itemGroups.reduce((sum, g) => sum + g.inAmount, 0);
  const totalInQty = itemGroups.reduce((sum, g) => sum + g.inQty, 0);
  const totalInAmount = itemGroups.reduce((sum, g) => sum + g.inAmount, 0);
  const totalOutQty = itemGroups.reduce((sum, g) => sum + g.outQty, 0);
  const totalOutAmount = itemGroups.reduce((sum, g) => sum + g.outAmount, 0);

  const [year, monthNum] = month.split("-");
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const thisMonth = currentMonth();
  const qSuffix = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F5: { submitFormSelector: "#monthly-report-search-form" },
          Escape: { href: "/dashboard" },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">확장모듈 &gt; 월별 리포트</h1>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        <Link href={`/reports/monthly?month=${prevMonth}${qSuffix}`} className="erp-date-preset-btn">
          ◀ 이전달
        </Link>
        <Link
          href={`/reports/monthly?month=${thisMonth}${qSuffix}`}
          className={`erp-date-preset-btn${month === thisMonth ? " active" : ""}`}
        >
          이번달
        </Link>
        <Link href={`/reports/monthly?month=${nextMonth}${qSuffix}`} className="erp-date-preset-btn">
          다음달 ▶
        </Link>
      </div>

      <form method="get" id="monthly-report-search-form" className="erp-search">
        <div className="erp-field">
          <label>기준월</label>
          <input type="month" name="month" defaultValue={month} className="erp-input" />
        </div>
        <div className="erp-field" style={{ minWidth: 240, flex: 1 }}>
          <label>품목 / 거래처 검색</label>
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="품목명, 규격, 거래처명"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {q && (
          <Link href={`/reports/monthly?month=${month}`} className="erp-btn">
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
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            {year}년 {Number(monthNum)}월 매출액
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {totalSalesAmount.toLocaleString()}원
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            {year}년 {Number(monthNum)}월 매입액
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {totalPurchaseAmount.toLocaleString()}원
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            거래 품목 수
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {itemGroups.length.toLocaleString()}개
          </div>
        </div>
        <div className="erp-home-panel" style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--erp-text-muted)", fontWeight: 600, marginBottom: 6 }}>
            거래처 수
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {companyIds.size.toLocaleString()}곳
          </div>
        </div>
      </div>

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
            {itemGroups.map((g) => (
              <Fragment key={g.productId}>
                <tr style={{ background: "#f5f7fa" }}>
                  <td style={{ fontWeight: 700 }}>
                    {g.name}
                    {g.spec !== "-" && (
                      <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}> ({g.spec})</span>
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
                  <tr key={`${g.productId}-${d.type}-${d.companyId}`}>
                    <td style={{ paddingLeft: 26 }}>
                      <Link
                        href={`/reports/monthly/company?month=${month}&company=${encodeURIComponent(
                          d.type === "in" ? `s:${d.companyId}` : `c:${d.companyId}`
                        )}`}
                        style={{ color: "var(--erp-text-muted)", textDecoration: "underline" }}
                      >
                        {d.companyName}
                      </Link>
                    </td>
                    <td>
                      <span className={`erp-badge erp-badge-${d.type === "in" ? "success" : "danger"}`}>
                        {d.type === "in" ? "입고" : "출고"}
                      </span>
                    </td>
                    <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                      {d.type === "in" ? `${d.quantity.toLocaleString()} ${g.unit ?? ""}` : "-"}
                    </td>
                    <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                      {d.type === "in" ? d.amount.toLocaleString() : "-"}
                    </td>
                    <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                      {d.type === "out" ? `${d.quantity.toLocaleString()} ${g.unit ?? ""}` : "-"}
                    </td>
                    <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                      {d.type === "out" ? d.amount.toLocaleString() : "-"}
                    </td>
                    <td className="num" style={{ color: "var(--erp-text-muted)" }}>
                      -
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
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
              <tr style={{ background: "#eef1f5", fontWeight: 700 }}>
                <td colSpan={2} className="erp-grid-sticky-label">
                  합계 ({itemGroups.length}개 품목)
                </td>
                <td className="num">{totalInQty.toLocaleString()}</td>
                <td className="num">{totalInAmount.toLocaleString()}</td>
                <td className="num">{totalOutQty.toLocaleString()}</td>
                <td className="num">{totalOutAmount.toLocaleString()}</td>
                <td className="num">{(totalInQty - totalOutQty).toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
