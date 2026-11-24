import { createClient } from "@/lib/supabase/server";
import { RecordPageA } from "@/components/grid/record-page-a";
import type { RecordRow } from "@/components/grid/record-list-a";
import { GridBadge } from "@/components/grid/badge";
import { getQuickDatePresets, getYearMonthButtons } from "@/lib/date-presets";
import { matchesSearch } from "@/lib/search-match";
import { fetchAllRows } from "@/lib/fetch-all-rows";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function PurchaseQuoteRequestsPage({
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
      .from("purchase_quote_requests")
      .select(
        "id, request_date, status, memo, target_supplier_ids, converted_purchase_request_id, selected_supplier:suppliers!selected_supplier_id(name), purchase_quote_request_items(id)",
      )
      .order("request_date", { ascending: false });
    if (from) query = query.gte("request_date", from);
    if (to) query = query.lte("request_date", to);
    return query;
  };

  // 검색어(q)가 있으면 화면에 보이는 limit건 안에서만 찾지 않고 조회기간
  // 전체에서 찾는다 — sales/purchases 목록과 같은 이유로 같은 버그가
  // 있었다(사용자 지적 — "작성자가 다른 건은 조회가 안 된다").
  const [rawRequests, { data: suppliers }] = await Promise.all([
    keyword
      ? fetchAllRows((from, to) => buildQuery().range(from, to))
      : buildQuery()
          .limit(limit)
          .then((r) => r.data ?? []),
    supabase.from("suppliers").select("id, name").limit(1000),
  ]);
  const hasMore = !keyword && rawRequests.length >= limit;

  const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
  const supplierNames = (r: { target_supplier_ids: string[] }) =>
    r.target_supplier_ids.map((sid) => supplierNameById.get(sid) ?? "").join(" ");

  const rows = keyword
    ? rawRequests.filter((r) => matchesSearch(keyword, supplierNames(r), r.memo))
    : rawRequests;

  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();

  const listParams = new URLSearchParams();
  if (from) listParams.set("from", from);
  if (to) listParams.set("to", to);
  if (q) listParams.set("q", q);
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/purchase-quote-requests?${moreParams.toString()}`;


  // 모던 테마(grid-modern) 전용 A형 화면 — 클래식은 classic.tsx(동결본).
  const recordRows: RecordRow[] = rows.map((r) => {
    const targets = r.target_supplier_ids.map((sid) => supplierNameById.get(sid) ?? "-").join(", ");
    const closed = r.status === "closed";
    const itemCount = (r.purchase_quote_request_items ?? []).length;
    const date = r.request_date.replaceAll("-", ".");
    const badge = <GridBadge tone={closed ? "ok" : "warn"}>{closed ? "확정완료" : "비교중"}</GridBadge>;
    return {
      id: r.id,
      href: `/purchase-quote-requests/${r.id}`,
      cells: [date, targets || "-", `${itemCount}건`, r.selected_supplier?.name ?? "-", badge],
        values: [r.request_date, targets, itemCount, r.selected_supplier?.name ?? null, closed ? "확정완료" : "비교중"],
      card: {
        title: (
          <>
            <span className="erp-row-card-partner">{targets || "-"}</span>
            {badge}
          </>
        ),
        sub: `품목 ${itemCount}건 · ${date}`,
      },
      panel: {
        title: targets || "-",
        subtitle: date,
        badge: { tone: closed ? "ok" : "warn", label: closed ? "확정완료" : "비교중" },
        kv: [
          { label: "품목", value: `${itemCount}건` },
          { label: "확정 매입처", value: r.selected_supplier?.name ?? "-" },
          { label: "구매요청 전환", value: r.converted_purchase_request_id ? "전환됨" : "-" },
          { label: "메모", value: r.memo || "-" },
        ],
        actions: [{ label: "수정·상세", href: `/purchase-quote-requests/${r.id}` }],
      },
    };
  });
  return (
    <RecordPageA
      title="매입관리 &gt; 구매 견적요청"
      basePath="/purchase-quote-requests"
      newLabel="견적요청 작성"
      searchFormId="purchase-quote-requests-search-form"
      filterBar={{ from, to, q, searchPlaceholder: "매입처명, 메모", presets, monthButtons, showReset: !!(from || to || q || limitParam) }}
      columns={[{ label: "요청일" }, { label: "대상 매입처" }, { label: "품목" }, { label: "확정 매입처" }, { label: "상태" }]}
      rows={recordRows}
      panelAriaLabel="선택한 견적요청 상세"
      hasMore={hasMore}
      moreHref={moreHref}
      moreStep={LIST_LIMIT_STEP}
      emptyMessage="조건에 맞는 견적요청이 없습니다."
    />
  );

}
