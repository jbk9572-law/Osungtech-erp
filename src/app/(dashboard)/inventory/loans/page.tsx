import { InventorySubTabs } from "@/components/erp/inventory-sub-tabs";
import { ListFilterBar } from "@/components/erp/list-filter-bar";
import Link from "next/link";
import { GuardedLink } from "@/components/erp/guarded-link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { StockLoanActions } from "@/components/stock-loan-actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { formatNumber } from "@/lib/format-number";
import { todayKstStr } from "@/lib/kst-date";
import { getQuickDatePresets, getYearMonthButtons, defaultListRange } from "@/lib/date-presets";

type LoanRow = {
  id: string;
  loan_date: string;
  due_date: string | null;
  status: "open" | "returned" | "cancelled";
  memo: string | null;
  created_by: string | null;
  customers: { name: string } | null;
  warehouses: { name: string } | null;
  stock_loan_items: { id: string; quantity: number; returned_quantity: number; products: { name: string; spec: string | null; unit: string } | null }[];
};

const STATUS_BADGE = {
  open: { tone: "info", label: "반출 중" },
  returned: { tone: "ok", label: "반납 완료" },
  cancelled: { tone: "muted", label: "취소" },
} as const;

// 일시반출 현황 — 빌려줬다가 돌려받는 거래의 장부. 기본은 "반출 중"(아직 안 돌아온 것, 기간 무관 — 오래된 건이 목록에서 사라지면 안 된다),
// "전체 이력"은 반출일 기준 조회기간으로 본다. 반납·취소는 이 화면에서 처리한다(등록은 매출 전표 등록 화면의 "일시반출" 탭).
export default async function StockLoansPage({ searchParams }: { searchParams: Promise<{ view?: string; from?: string; to?: string }> }) {
  const { view, from, to } = await searchParams;
  const history = view === "all";
  const { from: effectiveFrom, to: effectiveTo } = defaultListRange(from, to);
  const today = todayKstStr();
  const supabase = await createClient();

  const loans = await fetchAllRows<LoanRow>((f, t) => {
    let q = supabase
      .from("stock_loans")
      .select(
        "id, loan_date, due_date, status, memo, created_by, customers(name), warehouses(name), stock_loan_items(id, quantity, returned_quantity, products(name, spec, unit))",
      );
    q = history ? q.gte("loan_date", effectiveFrom).lte("loan_date", effectiveTo) : q.eq("status", "open");
    return q.order("loan_date", { ascending: false }).order("created_at", { ascending: false }).range(f, t);
  });

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/sales/new" }, Escape: { href: "/inventory" } }} />
      <ListPageHeader title="재고관리 > 일시반출 현황" />
      <InventorySubTabs />
      <PageGuide>
        거래처에 물건을 잠시 빌려줬다가 돌려받는 거래입니다. 반출하면 재고가 바로 빠지고, 반납 처리하면 재고가 돌아옵니다. 매출·미수금·세금계산서에는 잡히지 않습니다.
        새 반출은 <GuardedLink href="/sales/new" className="underline">매출 전표 등록</GuardedLink>의 &quot;일시반출&quot; 탭에서 등록하세요.
      </PageGuide>

      <nav className="erp-subtabs" aria-label="반출 보기">
        <Link href="/inventory/loans" className={`erp-subtab${history ? "" : " active"}`} aria-current={history ? undefined : "page"}>반출 중</Link>
        <Link href="/inventory/loans?view=all" className={`erp-subtab${history ? " active" : ""}`} aria-current={history ? "page" : undefined}>전체 이력</Link>
      </nav>
      {history && (
        <ListFilterBar
          formId="loans-search-form"
          basePath="/inventory/loans"
          from={effectiveFrom}
          to={effectiveTo}
          presets={getQuickDatePresets()}
          monthButtons={getYearMonthButtons()}
          hidden={{ view: "all" }}
          legacy={<DateRangeQuickFilters basePath="/inventory/loans" presets={getQuickDatePresets()} monthButtons={getYearMonthButtons()} from={effectiveFrom} to={effectiveTo} extraParams={{ view: "all" }} />}
        />
      )}

      <div className="erp-grid-wrap">
        <table className="erp-grid" style={{ width: "100%", minWidth: 960 }}>
          <thead>
            <tr>
              <th className="erp-col-m">반출일</th>
              <th className="erp-col-xxl">반출처</th>
              <th>품목</th>
              <th className="num erp-col-l">미반납 수량</th>
              <th className="erp-col-xl">반납 예정일</th>
              <th className="erp-col-m">상태</th>
              <th className="erp-col-xw">처리</th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 && (
              <tr>
                <td colSpan={7} className="erp-grid-empty">
                  {history ? "이 기간에 일시반출이 없습니다." : "반출 중인 물건이 없습니다."}
                </td>
              </tr>
            )}
            {loans.map((loan) => {
              const outstanding = loan.stock_loan_items.reduce((s, i) => s + (Number(i.quantity) - Number(i.returned_quantity)), 0);
              const overdue = loan.status === "open" && !!loan.due_date && loan.due_date < today;
              const badge = STATUS_BADGE[loan.status];
              return (
                <tr key={loan.id}>
                  <td>{loan.loan_date}</td>
                  <td>{loan.customers?.name ?? "-"}</td>
                  <td className="erp-u-wrap">
                    {loan.stock_loan_items.map((i) => `${i.products?.name ?? "품목"}${i.products?.spec ? ` (${i.products.spec})` : ""} ${formatNumber(Number(i.quantity))}${i.products?.unit ?? ""}`).join(", ")}
                    {loan.memo && <div className="erp-u-muted erp-u-text-xs">{loan.memo}</div>}
                  </td>
                  <td className="num">{loan.status === "open" ? formatNumber(outstanding) : "-"}</td>
                  <td>
                    {loan.due_date ?? "-"} {overdue && <GridBadge tone="danger">연체</GridBadge>}
                  </td>
                  <td><GridBadge tone={badge.tone}>{badge.label}</GridBadge></td>
                  <td>{loan.status === "open" && <StockLoanActions loanId={loan.id} items={loan.stock_loan_items.map((i) => ({ id: i.id, name: i.products?.name ?? "품목", unit: i.products?.unit ?? "", outstanding: Number(i.quantity) - Number(i.returned_quantity), returned: Number(i.returned_quantity) }))} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
