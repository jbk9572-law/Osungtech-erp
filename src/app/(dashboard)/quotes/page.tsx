import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { QuoteStatusBadge } from "@/components/quote-status-badge";
import { QuoteDetailPanel } from "@/components/quote-detail-panel";
import { NewQuoteForm } from "@/components/new-quote-form";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { getQuickDatePresets, getYearMonthButtons } from "@/lib/date-presets";
import { matchesSearch } from "@/lib/search-match";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { formatNumber } from "@/lib/format-number";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { isUuid } from "@/lib/is-uuid";
import { todayKstStr } from "@/lib/kst-date";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; limit?: string; id?: string }>;
}) {
  const { from, to, q, limit: limitParam, id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
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
    : rawQuotes ?? [];

  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();

  const listParams = new URLSearchParams();
  if (from) listParams.set("from", from);
  if (to) listParams.set("to", to);
  if (q) listParams.set("q", q);
  const rowHref = (quoteId: string) => {
    const p = new URLSearchParams(listParams);
    p.set("id", quoteId);
    return `/quotes?${p.toString()}`;
  };
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/quotes?${moreParams.toString()}`;
  const newHref = listParams.toString() ? `/quotes?${listParams.toString()}` : "/quotes";

  let formData: {
    customers: { id: string; name: string }[];
    products: { id: string; sku: string; name: string; spec: string | null; price: number }[];
  } | null = null;
  if (!selectedId) {
    const [customers, products] = await Promise.all([
      fetchAllRows<{ id: string; name: string }>((f, t) => supabase.from("customers").select("id, name").order("name").range(f, t)),
      fetchAllRows<{ id: string; sku: string; name: string; spec: string | null; price: number }>((f, t) =>
        supabase.from("products").select("id, sku, name, spec, price").order("name").range(f, t),
      ),
    ]);
    formData = { customers, products };
  }

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{ F2: { href: newHref }, F5: { submitFormSelector: "#quotes-search-form" }, Escape: { href: selectedId ? newHref : "/dashboard" } }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <ListPageHeader
          title="견적서관리"
          actions={
            <>
              <Link href={newHref} className="erp-btn erp-btn-primary">
                F2 견적서 작성
              </Link>
              {selectedId && (
                <Link href={newHref} className="erp-btn">
                  목록
                </Link>
              )}
            </>
          }
        />
      </div>

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

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>견적서 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>총 {formatNumber(quotes.length)}건</span>
          </div>
          <div className="erp-split-list-body">
            {quotes.map((quote) => {
              const total = (quote.quote_items ?? []).reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
              return (
                <Link
                  key={quote.id}
                  href={rowHref(quote.id)}
                  className={`erp-split-list-row${quote.id === selectedId ? " active" : ""}`}
                >
                  {quote.customers?.name ?? "-"}
                  <span style={{ marginLeft: 6 }}>
                    <QuoteStatusBadge status={quote.status} />
                  </span>
                  <div className="erp-split-list-row-sub">
                    #{quote.doc_no} · {formatNumber(total)}원 · {quote.quote_date.replaceAll("-", ".")}
                    {quote.converted_sales_order_id ? " · 수주전환됨" : ""}
                  </div>
                </Link>
              );
            })}
            {quotes.length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                조건에 맞는 견적서가 없습니다.
              </p>
            )}
          </div>
          {hasMore && (
            <div style={{ padding: 8, borderTop: "1px solid var(--erp-border)" }}>
              <Link href={moreHref} className="erp-btn" style={{ width: "100%" }}>
                더보기 (다음 {formatNumber(LIST_LIMIT_STEP)}줄)
              </Link>
            </div>
          )}
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <QuoteDetailPanel id={selectedId} closeHref={newHref} />
          ) : (
            formData && (
              <NewQuoteForm today={todayKstStr()} customers={formData.customers} products={formData.products} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
