import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { calcVat } from "@/lib/tax";
import { nowInKst } from "@/lib/kst-date";
import { shiftMonth } from "@/lib/date-presets";
import { effectiveMonth } from "@/lib/carryover";

// [from, to] 구간에 걸쳐 있는 "YYYY-MM" 월 목록 — 이월(carryover) 건을
// effectiveMonth 기준으로 걸러낼 때 쓴다. 분기 버튼은 항상 월 경계에
// 딱 맞지만, 사용자가 날짜를 직접 입력하면 월 중간일 수도 있어 그 달
// 전체를 포함시킨다(reports/monthly와 같은 월 단위 판정 방식).
function monthsInRange(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = from.slice(0, 7);
  const last = to.slice(0, 7);
  for (let i = 0; i < 24 && cursor <= last; i++) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }
  return months;
}

type TaxType = "과세" | "면세" | "영세";

function quarterRange(year: number, quarter: 1 | 2 | 3 | 4): { from: string; to: string } {
  const startMonth = (quarter - 1) * 3; // 0-indexed
  const from = new Date(year, startMonth, 1);
  const to = new Date(year, startMonth + 3, 0);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(from), to: fmt(to) };
}

function emptyTotals() {
  return { 과세: 0, 면세: 0, 영세: 0 };
}

export default async function VatReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  // 서버는 보통 UTC로 돈다 — 분기 경계일(1/1, 4/1, 7/1, 10/1) 자정~오전
  // 9시(KST) 사이에는 new Date()의 getMonth()가 아직 이전 분기를 가리켜
  // 기본 선택 분기가 하루 늦게 바뀌는 문제가 있었다. 다른 리포트들처럼
  // KST 기준으로 "오늘"을 구한다(kst-date.ts).
  const now = nowInKst();
  const currentYear = now.getUTCFullYear();
  const defaultQuarter = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const defaultRange = quarterRange(currentYear, defaultQuarter);
  const { from: fromParam, to: toParam } = await searchParams;
  const from = fromParam || defaultRange.from;
  const to = toParam || defaultRange.to;

  const supabase = await createClient();

  // 이월(is_carryover) 건은 거래일자가 실제로는 전월인데 이번 신고기간
  // 실적으로 잡혀야 하므로, 조회 범위를 전월 1일까지 넓혀서 가져온 뒤
  // effectiveMonth 기준으로 다시 걸러야 한다 — reports/monthly와 같은 패턴.
  const lookbackFrom = shiftMonth(from.slice(0, 7), -1) + "-01";
  const months = monthsInRange(from, to);

  const [salesRowsRaw, purchaseRowsRaw] = await Promise.all([
    fetchAllRows<{
      id: string;
      is_return: boolean;
      tax_type: TaxType;
      order_date: string;
      is_carryover: boolean;
      sales_order_items: { quantity: number; unit_price: number }[];
    }>((f, t) =>
      supabase
        .from("sales_orders")
        .select("id, is_return, tax_type, order_date, is_carryover, sales_order_items(quantity, unit_price)")
        .gte("order_date", lookbackFrom)
        .lte("order_date", to)
        .range(f, t)
    ),
    fetchAllRows<{
      id: string;
      tax_type: TaxType;
      purchase_date: string;
      is_carryover: boolean;
      purchase_order_items: { quantity: number; unit_cost: number }[];
    }>((f, t) =>
      supabase
        .from("purchase_orders")
        .select("id, tax_type, purchase_date, is_carryover, purchase_order_items(quantity, unit_cost)")
        .gte("purchase_date", lookbackFrom)
        .lte("purchase_date", to)
        .range(f, t)
    ),
  ]);

  const salesRows = salesRowsRaw.filter((r) => months.includes(effectiveMonth(r.order_date, r.is_carryover)));
  const purchaseRows = purchaseRowsRaw.filter((r) => months.includes(effectiveMonth(r.purchase_date, r.is_carryover)));

  const salesSupply = emptyTotals();
  for (const order of salesRows) {
    const sign = order.is_return ? -1 : 1;
    const amount = order.sales_order_items.reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0) * sign;
    salesSupply[order.tax_type] += amount;
  }

  const purchaseSupply = emptyTotals();
  for (const order of purchaseRows) {
    const amount = order.purchase_order_items.reduce((sum, i) => sum + i.quantity * Number(i.unit_cost), 0);
    purchaseSupply[order.tax_type] += amount;
  }

  const salesTax = calcVat(salesSupply.과세);
  const purchaseTax = calcVat(purchaseSupply.과세);
  const payable = salesTax - purchaseTax;

  const quarterLinks = ([1, 2, 3, 4] as const).map((q) => ({
    label: `${currentYear}년 ${q}분기`,
    ...quarterRange(currentYear, q),
  }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="부가세 신고 자료" />
      <PageGuide>
        매출/매입 전표에 이미 등록된 과세유형(과세/면세/영세)을 기준으로 매출세액·매입세액을 자동 집계합니다.
        실제 신고는 담당 세무사/홈택스를 통해 별도로 진행해주세요 — 이 화면은 신고 전 참고 자료입니다.
      </PageGuide>

      <div className="erp-toolbar">
        {quarterLinks.map((q) => (
          <Link key={q.label} href={`/reports/vat?from=${q.from}&to=${q.to}`} className={`erp-btn${q.from === from && q.to === to ? " erp-btn-primary" : ""}`}>
            {q.label}
          </Link>
        ))}
      </div>

      <form className="erp-toolbar" style={{ marginTop: -4 }}>
        <input type="date" name="from" defaultValue={from} className="erp-input" style={{ width: "auto" }} />
        <span>~</span>
        <input type="date" name="to" defaultValue={to} className="erp-input" style={{ width: "auto" }} />
        <button type="submit" className="erp-btn">
          조회
        </button>
        <a
          href={`/api/reports/vat/export?from=${from}&to=${to}`}
          className="erp-btn"
          title="현재 화면 그대로 엑셀로 다운로드"
          style={{ marginLeft: "auto" }}
        >
          📥 엑셀 다운로드
        </a>
      </form>

      <p className="mb-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
        조회기간: {from.replaceAll("-", ".")} ~ {to.replaceAll("-", ".")}
      </p>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th></th>
              <th className="num">과세 공급가액</th>
              <th className="num">영세 공급가액</th>
              <th className="num">면세 공급가액</th>
              <th className="num">세액</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 700 }}>매출</td>
              <td className="num">{salesSupply.과세.toLocaleString()}</td>
              <td className="num">{salesSupply.영세.toLocaleString()}</td>
              <td className="num">{salesSupply.면세.toLocaleString()}</td>
              <td className="num" style={{ fontWeight: 700 }}>{salesTax.toLocaleString()}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>매입</td>
              <td className="num">{purchaseSupply.과세.toLocaleString()}</td>
              <td className="num">{purchaseSupply.영세.toLocaleString()}</td>
              <td className="num">{purchaseSupply.면세.toLocaleString()}</td>
              <td className="num" style={{ fontWeight: 700 }}>{purchaseTax.toLocaleString()}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="num" style={{ fontWeight: 700 }}>
                {payable >= 0 ? "납부(예상) 세액" : "환급(예상) 세액"}
              </td>
              <td className="num" style={{ fontWeight: 700, color: payable >= 0 ? "var(--erp-danger)" : "var(--erp-success)" }}>
                {Math.abs(payable).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
