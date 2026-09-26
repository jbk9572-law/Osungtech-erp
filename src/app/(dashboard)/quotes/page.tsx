import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { QuoteStatusBadge } from "@/components/quote-status-badge";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { getQuickDatePresets, getYearMonthButtons } from "@/lib/date-presets";
import { matchesSearch } from "@/lib/search-match";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; limit?: string }>;
}) {
  const { from, to, q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;

  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "crm");

  let query = supabase
    .from("quotes")
    .select(
      "id, doc_no, quote_date, valid_until, status, memo, converted_sales_order_id, customers(name), quote_items(quantity, unit_price)",
    )
    .order("quote_date", { ascending: false })
    .limit(limit);
  if (from) query = query.gte("quote_date", from);
  if (to) query = query.lte("quote_date", to);

  const { data: rawQuotes } = await query;
  const hasMore = (rawQuotes?.length ?? 0) >= limit;

  const keyword = q?.trim().toLowerCase();
  const quotes = keyword
    ? (rawQuotes ?? []).filter((quote) =>
        matchesSearch(keyword, quote.customers?.name, quote.memo, String(quote.doc_no ?? "")),
      )
    : rawQuotes;

  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();
  const moreParams = new URLSearchParams();
  if (from) moreParams.set("from", from);
  if (to) moreParams.set("to", to);
  if (q) moreParams.set("q", q);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/quotes?${moreParams.toString()}`;

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{ F2: { href: "/quotes/new" }, F5: { submitFormSelector: "#quotes-search-form" }, Escape: { href: "/dashboard" } }}
      />
      <ListPageHeader
        title="견적서관리"
        actions={
          <Link href="/quotes/new" className="erp-btn erp-btn-primary">
            F2 견적서 작성
          </Link>
        }
      />

      <DateRangeQuickFilters basePath="/quotes" presets={presets} monthButtons={monthButtons} from={from} to={to} />

      <form method="get" id="quotes-search-form" className="erp-search">
        <div className="erp-field">
          <label htmlFor="quotes-search-from">시작일</label>
          <input id="quotes-search-from" type="date" name="from" defaultValue={from ?? ""} className="erp-input" />
        </div>
        <div className="erp-field">
          <label htmlFor="quotes-search-to">종료일</label>
          <input id="quotes-search-to" type="date" name="to" defaultValue={to ?? ""} className="erp-input" />
        </div>
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="quotes-search-q">거래처 / 견적번호 / 메모 검색</label>
          <input
            id="quotes-search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="거래처명, 견적번호, 메모"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(from || to || q || limitParam) && (
          <Link href="/quotes" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 90 }}>견적일</th>
              <th style={{ width: 80 }}>견적번호</th>
              <th style={{ width: 160 }}>거래처</th>
              <th className="num" style={{ width: 70 }}>품목 수</th>
              <th className="num" style={{ width: 120 }}>합계금액</th>
              <th style={{ width: 90 }}>유효기한</th>
              <th style={{ width: 90 }}>상태</th>
              <th style={{ width: 90 }}>수주전환</th>
            </tr>
          </thead>
          <tbody>
            {(quotes ?? []).map((q) => {
              const total = (q.quote_items ?? []).reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
              return (
                <ClickableRow key={q.id} href={`/quotes/${q.id}`}>
                  <td>{q.quote_date.replaceAll("-", ".")}</td>
                  <td>{q.doc_no}</td>
                  <td>{q.customers?.name ?? "-"}</td>
                  <td className="num">{(q.quote_items ?? []).length}</td>
                  <td className="num">{total.toLocaleString()}</td>
                  <td>{q.valid_until ? q.valid_until.replaceAll("-", ".") : "-"}</td>
                  <td>
                    <QuoteStatusBadge status={q.status} />
                  </td>
                  <td>{q.converted_sales_order_id ? "전환됨" : "-"}</td>
                </ClickableRow>
              );
            })}
            {(!quotes || quotes.length === 0) && (
              <tr>
                <td colSpan={8} className="erp-grid-empty">
                  조건에 맞는 견적서가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Link href={moreHref} className="erp-btn">
            더보기 (다음 {LIST_LIMIT_STEP.toLocaleString()}줄)
          </Link>
        </div>
      )}
    </div>
  );
}
