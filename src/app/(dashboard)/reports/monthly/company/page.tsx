import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { currentMonth, getMonthRange, shiftMonth } from "@/lib/date-presets";

type Transaction = {
  date: string;
  type: "in" | "out";
  productName: string;
  spec: string;
  unit: string | null;
  quantity: number;
  amount: number;
  orderId: string;
};

export default async function MonthlyReportCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; company?: string }>;
}) {
  const { month: monthParam, company } = await searchParams;
  const month = monthParam || currentMonth();
  const { from, to } = getMonthRange(month);

  const [type, id] = company?.split(":") ?? [];
  if (type !== "s" && type !== "c") {
    redirect(`/reports/monthly?month=${month}`);
  }

  const supabase = await createClient();

  let companyName = "";
  let rows: Transaction[] = [];

  if (type === "s") {
    const [{ data: supplier }, { data }] = await Promise.all([
      supabase.from("suppliers").select("name").eq("id", id).maybeSingle(),
      supabase
        .from("purchase_order_items")
        .select(
          "quantity, unit_cost, product_id, purchase_order_id, purchase_orders!inner(purchase_date, supplier_id), products(name, spec, unit)"
        )
        .eq("purchase_orders.supplier_id", id)
        .gte("purchase_orders.purchase_date", from)
        .lte("purchase_orders.purchase_date", to)
        .limit(2000),
    ]);
    companyName = supplier?.name ?? "";
    rows = (data ?? []).map((row) => ({
      date: row.purchase_orders.purchase_date,
      type: "in" as const,
      productName: row.products?.name ?? "-",
      spec: row.products?.spec ?? "-",
      unit: row.products?.unit ?? null,
      quantity: row.quantity,
      amount: row.quantity * Number(row.unit_cost),
      orderId: row.purchase_order_id,
    }));
  } else {
    const [{ data: customer }, { data }] = await Promise.all([
      supabase.from("customers").select("name").eq("id", id).maybeSingle(),
      supabase
        .from("sales_order_items")
        .select(
          "quantity, unit_price, product_id, sales_order_id, sales_orders!inner(order_date, customer_id), products(name, spec, unit)"
        )
        .eq("sales_orders.customer_id", id)
        .gte("sales_orders.order_date", from)
        .lte("sales_orders.order_date", to)
        .limit(2000),
    ]);
    companyName = customer?.name ?? "";
    rows = (data ?? []).map((row) => ({
      date: row.sales_orders.order_date,
      type: "out" as const,
      productName: row.products?.name ?? "-",
      spec: row.products?.spec ?? "-",
      unit: row.products?.unit ?? null,
      quantity: row.quantity,
      amount: row.quantity * Number(row.unit_price),
      orderId: row.sales_order_id,
    }));
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.productName.localeCompare(b.productName));

  const inQty = rows.filter((t) => t.type === "in").reduce((sum, t) => sum + t.quantity, 0);
  const inAmount = rows.filter((t) => t.type === "in").reduce((sum, t) => sum + t.amount, 0);
  const outQty = rows.filter((t) => t.type === "out").reduce((sum, t) => sum + t.quantity, 0);
  const outAmount = rows.filter((t) => t.type === "out").reduce((sum, t) => sum + t.amount, 0);

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const thisMonth = currentMonth();
  const companySuffix = `&company=${encodeURIComponent(company ?? "")}`;

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          Escape: { href: `/reports/monthly?month=${month}` },
        }}
      />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">
        확장모듈 &gt; 월별 리포트 &gt; {companyName || "거래처"} 상세내역
      </h1>

      <div className="erp-date-presets" style={{ marginBottom: 8 }}>
        <Link
          href={`/reports/monthly/company?month=${prevMonth}${companySuffix}`}
          className="erp-date-preset-btn"
        >
          ◀ 이전달
        </Link>
        <Link
          href={`/reports/monthly/company?month=${thisMonth}${companySuffix}`}
          className={`erp-date-preset-btn${month === thisMonth ? " active" : ""}`}
        >
          이번달
        </Link>
        <Link
          href={`/reports/monthly/company?month=${nextMonth}${companySuffix}`}
          className="erp-date-preset-btn"
        >
          다음달 ▶
        </Link>
      </div>

      <div className="erp-toolbar" style={{ marginBottom: 12 }}>
        <Link href={`/reports/monthly?month=${month}`} className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
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
            {rows.map((t, i) => (
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
            {!rows.length && (
              <tr>
                <td colSpan={6} className="erp-grid-empty">
                  해당 월에 거래 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: "#eef1f5", fontWeight: 700 }}>
                <td colSpan={4} className="erp-grid-sticky-label">
                  합계 ({rows.length}건)
                </td>
                <td className="num">
                  {inQty > 0 && `입고 ${inQty.toLocaleString()}`}
                  {inQty > 0 && outQty > 0 && " / "}
                  {outQty > 0 && `출고 ${outQty.toLocaleString()}`}
                </td>
                <td className="num">{(inAmount + outAmount).toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
