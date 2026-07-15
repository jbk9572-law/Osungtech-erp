import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ClickableRow } from "@/components/clickable-row";
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

type Transaction = {
  date: string;
  type: "in" | "out";
  companyKey: string;
  companyName: string;
  productName: string;
  spec: string;
  unit: string | null;
  quantity: number;
  amount: number;
  orderId: string;
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

  const [{ data: salesRows }, { data: purchaseRows }] = await Promise.all([
    supabase
      .from("sales_order_items")
      .select(
        "quantity, unit_price, product_id, sales_order_id, sales_orders!inner(order_date, customers(id, name)), products(name, spec, unit)"
      )
      .gte("sales_orders.order_date", from)
      .lte("sales_orders.order_date", to)
      .limit(2000),
    supabase
      .from("purchase_order_items")
      .select(
        "quantity, unit_cost, product_id, purchase_order_id, purchase_orders!inner(purchase_date, suppliers(id, name)), products(name, spec, unit)"
      )
      .gte("purchase_orders.purchase_date", from)
      .lte("purchase_orders.purchase_date", to)
      .limit(2000),
  ]);

  const groups = new Map<string, ItemGroup>();
  const companyIds = new Set<string>();
  const companyNameByKey = new Map<string, string>();
  const transactions: Transaction[] = [];

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
      transactions.push({
        date: row.purchase_orders.purchase_date,
        type: "in",
        companyKey,
        companyName: supplier.name,
        productName,
        spec,
        unit,
        quantity: row.quantity,
        amount,
        orderId: row.purchase_order_id,
      });
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
      transactions.push({
        date: row.sales_orders.order_date,
        type: "out",
        companyKey,
        companyName: customer.name,
        productName,
        spec,
        unit,
        quantity: row.quantity,
        amount,
        orderId: row.sales_order_id,
      });
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

  // 검색어가 거래처 하나로 정확히 특정될 때만(여러 거래처가 매칭되면 어느
  // 거래처인지 모호하므로 생략) 그 거래처의 이번달 일자별 개별 거래 내역을
  // 별도 표로 추가로 보여준다.
  let matchedCompanyName: string | null = null;
  let companyDetailRows: Transaction[] = [];
  if (keyword) {
    const matchedKeys = Array.from(companyNameByKey.entries())
      .filter(([, name]) => name.toLowerCase().includes(keyword))
      .map(([key]) => key);
    if (matchedKeys.length === 1) {
      const [matchedKey] = matchedKeys;
      matchedCompanyName = companyNameByKey.get(matchedKey) ?? null;
      companyDetailRows = transactions
        .filter((t) => t.companyKey === matchedKey)
        .sort((a, b) => a.date.localeCompare(b.date) || a.productName.localeCompare(b.productName));
    }
  }
  const companyDetailInQty = companyDetailRows
    .filter((t) => t.type === "in")
    .reduce((sum, t) => sum + t.quantity, 0);
  const companyDetailInAmount = companyDetailRows
    .filter((t) => t.type === "in")
    .reduce((sum, t) => sum + t.amount, 0);
  const companyDetailOutQty = companyDetailRows
    .filter((t) => t.type === "out")
    .reduce((sum, t) => sum + t.quantity, 0);
  const companyDetailOutAmount = companyDetailRows
    .filter((t) => t.type === "out")
    .reduce((sum, t) => sum + t.amount, 0);

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
                    <td style={{ paddingLeft: 26, color: "var(--erp-text-muted)" }}>{d.companyName}</td>
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
                <td colSpan={2}>합계 ({itemGroups.length}개 품목)</td>
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

      {matchedCompanyName && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, margin: "20px 0 8px" }}>
            {matchedCompanyName} — 일자별 입출고 상세내역
          </div>
          <div className="erp-grid-wrap">
            <table className="erp-grid">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>날짜</th>
                  <th style={{ width: 70 }}>구분</th>
                  <th>품목</th>
                  <th style={{ width: 160 }}>규격</th>
                  <th className="num" style={{ width: 110 }}>
                    수량
                  </th>
                  <th className="num" style={{ width: 120 }}>
                    금액
                  </th>
                </tr>
              </thead>
              <tbody>
                {companyDetailRows.map((t, i) => (
                  <ClickableRow
                    key={`${t.orderId}-${i}`}
                    href={t.type === "in" ? `/purchases/${t.orderId}` : `/sales/${t.orderId}`}
                  >
                    <td>{t.date}</td>
                    <td>
                      <span className={`erp-badge erp-badge-${t.type === "in" ? "success" : "danger"}`}>
                        {t.type === "in" ? "입고" : "출고"}
                      </span>
                    </td>
                    <td>{t.productName}</td>
                    <td style={{ color: "var(--erp-text-muted)" }}>{t.spec !== "-" ? t.spec : "-"}</td>
                    <td className="num">
                      {t.quantity.toLocaleString()} {t.unit}
                    </td>
                    <td className="num">{t.amount.toLocaleString()}</td>
                  </ClickableRow>
                ))}
                {!companyDetailRows.length && (
                  <tr>
                    <td colSpan={6} className="erp-grid-empty">
                      해당 월에 거래 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
              {companyDetailRows.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#eef1f5", fontWeight: 700 }}>
                    <td colSpan={4}>합계 ({companyDetailRows.length}건)</td>
                    <td className="num">
                      {companyDetailInQty > 0 &&
                        `입고 ${companyDetailInQty.toLocaleString()}`}
                      {companyDetailInQty > 0 && companyDetailOutQty > 0 && " / "}
                      {companyDetailOutQty > 0 &&
                        `출고 ${companyDetailOutQty.toLocaleString()}`}
                    </td>
                    <td className="num">
                      {(companyDetailInAmount + companyDetailOutAmount).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
