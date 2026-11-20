import { createClient } from "@/lib/supabase/server";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { DateRangeSearchForm } from "@/components/erp/date-range-search-form";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { getQuickDatePresets, getYearMonthButtons } from "@/lib/date-presets";
import { matchesSearch } from "@/lib/search-match";
import { formatNumber } from "@/lib/format-number";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { resolveStatusLabel } from "@/lib/status-label";
import { RecordPageA } from "@/components/grid/record-page-a";
import type { RecordRow } from "@/components/grid/record-list-a";

const STATUS_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "작성중", tone: "muted" },
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
};

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; limit?: string; id?: string }>;
}) {
  const { from, to, q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;

  const supabase = await createClient();

  const keyword = q?.trim().toLowerCase();

  const buildQuery = () => {
    let query = supabase
      .from("purchase_requests")
      .select(
        "id, request_date, status, converted_purchase_order_id, memo, suppliers(name), profiles!requested_by(full_name), purchase_request_items(quantity, estimated_unit_price)",
      )
      .order("request_date", { ascending: false });
    if (from) query = query.gte("request_date", from);
    if (to) query = query.lte("request_date", to);
    return query;
  };

  // 검색어(q)가 있으면 화면에 보이는 limit건 안에서만 찾지 않고 조회기간
  // 전체에서 찾는다 — sales/purchases 목록과 같은 이유로 같은 버그가
  // 있었다(사용자 지적 — "작성자가 다른 건은 조회가 안 된다").
  const rawRequests = keyword
    ? await fetchAllRows((from, to) => buildQuery().range(from, to))
    : await buildQuery()
        .limit(limit)
        .then((r) => r.data ?? []);
  const hasMore = !keyword && rawRequests.length >= limit;

  const requests = keyword
    ? rawRequests.filter((r) => matchesSearch(keyword, r.suppliers?.name, r.memo, r.profiles?.full_name))
    : rawRequests;

  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();

  const listParams = new URLSearchParams();
  if (from) listParams.set("from", from);
  if (to) listParams.set("to", to);
  if (q) listParams.set("q", q);
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/purchase-requests?${moreParams.toString()}`;

  const filters = (
    <>
      <DateRangeQuickFilters basePath="/purchase-requests" presets={presets} monthButtons={monthButtons} from={from} to={to} />

      <DateRangeSearchForm formId="purchase-requests-search-form" idPrefix="pr" from={from} to={to} q={q} qLabel="공급처 / 작성자 / 메모 검색" qPlaceholder="공급처명, 작성자, 메모" resetHref="/purchase-requests" showReset={!!(from || to || q || limitParam)} />
    </>
  );

  // 모던 테마(grid-modern) 전용 A형 화면 — 클래식은 classic.tsx(동결본).
  const rows: RecordRow[] = requests.map((r) => {
    const total = (r.purchase_request_items ?? []).reduce((sum, i) => sum + Number(i.quantity) * Number(i.estimated_unit_price), 0);
    const status = resolveStatusLabel(STATUS_LABEL, r.status);
    const supplier = r.suppliers?.name ?? "-";
    const date = r.request_date.replaceAll("-", ".");
    const writer = r.profiles?.full_name ?? "-";
    return {
      id: r.id,
      href: `/purchase-requests/${r.id}`,
      cells: [date, supplier, writer, formatNumber(total), <GridBadge key="s" tone={status.tone}>{status.label}</GridBadge>, r.converted_purchase_order_id ? "발주전환" : "-"],
        values: [r.request_date, supplier, writer, total, status.label, r.converted_purchase_order_id ? "발주전환" : ""],
      card: {
        title: (
          <>
            <span className="erp-row-card-partner">{supplier}</span>
            <GridBadge tone={status.tone}>{status.label}</GridBadge>
          </>
        ),
        sub: `${date} · ${writer}`,
        foot: <span className="erp-row-card-amount">{formatNumber(total)}원</span>,
      },
      panel: {
        title: supplier,
        subtitle: `${date} · ${writer}`,
        badge: { tone: status.tone === "danger" ? "danger" : status.tone === "warn" ? "warn" : "ok", label: status.label },
        kv: [
          { label: "작성자", value: writer },
          { label: "발주전환", value: r.converted_purchase_order_id ? "전환됨" : "-" },
          { label: "메모", value: r.memo || "-" },
        ],
        totals: [
          { label: "품목", value: `${formatNumber((r.purchase_request_items ?? []).length)}건` },
          { label: "예상 금액", value: formatNumber(total), strong: true },
        ],
        actions: [{ label: "수정·상세", href: `/purchase-requests/${r.id}` }],
      },
    };
  });
  return (
    <RecordPageA
      title="매입관리 &gt; 구매요청"
      basePath="/purchase-requests"
      newLabel="구매요청 작성"
      searchFormId="purchase-requests-search-form"
      filters={filters}
      columns={[{ label: "요청일" }, { label: "공급처" }, { label: "작성자" }, { label: "예상 금액", num: true }, { label: "상태" }, { label: "발주" }]}
      rows={rows}
      panelAriaLabel="선택한 구매요청 상세"
      hasMore={hasMore}
      moreHref={moreHref}
      moreStep={LIST_LIMIT_STEP}
      emptyMessage="조건에 맞는 구매요청이 없습니다."
    />
  );

}
