import { ListFilterCard } from "@/components/erp/list-filter-card";
import { createClient } from "@/lib/supabase/server";
import { QuoteStatusBadge } from "@/components/quote-status-badge";
import { DateRangeSearchForm } from "@/components/erp/date-range-search-form";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { getQuickDatePresets, getYearMonthButtons } from "@/lib/date-presets";
import { matchesSearch } from "@/lib/search-match";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { formatNumber } from "@/lib/format-number";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { RecordPageA } from "@/components/grid/record-page-a";
import type { RecordRow } from "@/components/grid/record-list-a";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; limit?: string; id?: string }>;
}) {
  const { from, to, q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;

  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "crm");

  const keyword = q?.trim().toLowerCase();

  const buildQuery = () => {
    let query = supabase
      .from("quotes")
      .select(
        "id, doc_no, quote_date, valid_until, status, memo, converted_sales_order_id, customers(name), quote_items(quantity, unit_price)",
      )
      .order("quote_date", { ascending: false });
    if (from) query = query.gte("quote_date", from);
    if (to) query = query.lte("quote_date", to);
    return query;
  };

  // 검색어(q)가 있으면 화면에 보이는 limit건 안에서만 찾지 않고 조회기간
  // 전체에서 찾는다 — sales/purchases 목록과 같은 이유로 같은 버그가
  // 있었다(사용자 지적 — "작성자가 다른 건은 조회가 안 된다").
  const rawQuotes = keyword
    ? await fetchAllRows((from, to) => buildQuery().range(from, to))
    : await buildQuery()
        .limit(limit)
        .then((r) => r.data ?? []);
  const hasMore = !keyword && rawQuotes.length >= limit;

  const quotes = keyword
    ? rawQuotes.filter((quote) =>
        matchesSearch(keyword, quote.customers?.name, quote.memo, String(quote.doc_no ?? "")),
      )
    : rawQuotes;

  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();

  const listParams = new URLSearchParams();
  if (from) listParams.set("from", from);
  if (to) listParams.set("to", to);
  if (q) listParams.set("q", q);
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/quotes?${moreParams.toString()}`;

  const filters = (
    <>
      <ListFilterCard>
        <DateRangeQuickFilters basePath="/quotes" presets={presets} monthButtons={monthButtons} from={from} to={to} />
        <DateRangeSearchForm formId="quotes-search-form" idPrefix="quotes" from={from} to={to} q={q} qLabel="거래처 / 견적번호 / 메모 검색" qPlaceholder="거래처명, 견적번호, 메모" resetHref="/quotes" showReset={!!(from || to || q || limitParam)} hideSubmit />
      </ListFilterCard>
    </>
  );

  // 모던 테마(grid-modern) 전용 A형 화면 — 클래식은 classic.tsx(동결본).
  const rows: RecordRow[] = quotes.map((quote) => {
    const total = (quote.quote_items ?? []).reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
    const customer = quote.customers?.name ?? "-";
    const date = quote.quote_date.replaceAll("-", ".");
    return {
      id: quote.id,
      href: `/quotes/${quote.id}`,
      cells: [`#${quote.doc_no}`, customer, date, quote.valid_until ? quote.valid_until.replaceAll("-", ".") : "-", formatNumber(total), <QuoteStatusBadge key="s" status={quote.status} />],
        values: [quote.doc_no, customer, quote.quote_date, quote.valid_until, total, quote.status],
      card: {
        title: (
          <>
            <span className="erp-row-card-partner">{customer}</span>
            <QuoteStatusBadge status={quote.status} />
          </>
        ),
        sub: `#${quote.doc_no} · ${date}`,
        foot: <span className="erp-row-card-amount">{formatNumber(total)}원</span>,
      },
      panel: {
        title: customer,
        subtitle: `#${quote.doc_no} · ${date}`,
        kv: [
          { label: "상태", value: <QuoteStatusBadge status={quote.status} /> },
          { label: "유효기한", value: quote.valid_until ? quote.valid_until.replaceAll("-", ".") : "-" },
          { label: "수주전환", value: quote.converted_sales_order_id ? "전환됨" : "-" },
          { label: "메모", value: quote.memo || "-" },
        ],
        totals: [
          { label: "품목", value: `${formatNumber((quote.quote_items ?? []).length)}건` },
          { label: "견적 금액", value: formatNumber(total), strong: true },
        ],
        actions: [
          { label: "수정·상세", href: `/quotes/${quote.id}` },
          { label: "인쇄", href: `/quotes/${quote.id}/print` },
        ],
      },
    };
  });
  return (
    <RecordPageA
      title="견적서관리"
      basePath="/quotes"
      newLabel="견적서 작성"
      searchFormId="quotes-search-form"
      filters={filters}
      columns={[{ label: "견적번호" }, { label: "거래처" }, { label: "견적일" }, { label: "유효기한" }, { label: "견적 금액", num: true }, { label: "상태" }]}
      rows={rows}
      panelAriaLabel="선택한 견적서 상세"
      hasMore={hasMore}
      moreHref={moreHref}
      moreStep={LIST_LIMIT_STEP}
      emptyMessage="조건에 맞는 견적서가 없습니다."
    />
  );

}
