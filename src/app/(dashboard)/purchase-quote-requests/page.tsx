import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { GridBadge } from "@/components/grid/badge";
import { PurchaseQuoteRequestDetailPanel } from "@/components/purchase-quote-request-detail-panel";
import { NewPurchaseQuoteRequestForm } from "@/components/new-purchase-quote-request-form";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { getQuickDatePresets, getYearMonthButtons } from "@/lib/date-presets";
import { matchesSearch } from "@/lib/search-match";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { isUuid } from "@/lib/is-uuid";
import { todayKstStr } from "@/lib/kst-date";
import { formatNumber } from "@/lib/format-number";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function PurchaseQuoteRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; limit?: string; id?: string }>;
}) {
  const { from, to, q, limit: limitParam, id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const supabase = await createClient();

  let query = supabase
    .from("purchase_quote_requests")
    .select(
      "id, request_date, status, memo, target_supplier_ids, converted_purchase_request_id, selected_supplier:suppliers!selected_supplier_id(name), purchase_quote_request_items(id)",
    )
    .order("request_date", { ascending: false })
    .limit(limit);
  if (from) query = query.gte("request_date", from);
  if (to) query = query.lte("request_date", to);

  const [{ data: rawRequests }, { data: suppliers }] = await Promise.all([
    query,
    supabase.from("suppliers").select("id, name").limit(1000),
  ]);
  const hasMore = (rawRequests?.length ?? 0) >= limit;

  const supplierNameById = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
  const supplierNames = (r: { target_supplier_ids: string[] }) =>
    r.target_supplier_ids.map((sid) => supplierNameById.get(sid) ?? "").join(" ");

  const keyword = q?.trim().toLowerCase();
  const rows = keyword
    ? (rawRequests ?? []).filter((r) => matchesSearch(keyword, supplierNames(r), r.memo))
    : rawRequests ?? [];

  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();

  const listParams = new URLSearchParams();
  if (from) listParams.set("from", from);
  if (to) listParams.set("to", to);
  if (q) listParams.set("q", q);
  const rowHref = (reqId: string) => {
    const p = new URLSearchParams(listParams);
    p.set("id", reqId);
    return `/purchase-quote-requests?${p.toString()}`;
  };
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/purchase-quote-requests?${moreParams.toString()}`;
  const newHref = listParams.toString() ? `/purchase-quote-requests?${listParams.toString()}` : "/purchase-quote-requests";

  let formData: {
    suppliers: { id: string; name: string }[];
    products: { id: string; sku: string; name: string; spec: string | null }[];
  } | null = null;
  if (!selectedId) {
    const [allSuppliers, products] = await Promise.all([
      fetchAllRows<{ id: string; name: string }>((f, t) => supabase.from("suppliers").select("id, name").order("name").range(f, t)),
      fetchAllRows<{ id: string; sku: string; name: string; spec: string | null }>((f, t) =>
        supabase.from("products").select("id, sku, name, spec").order("name").range(f, t),
      ),
    ]);
    formData = { suppliers: allSuppliers, products };
  }

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: newHref },
          F5: { submitFormSelector: "#purchase-quote-requests-search-form" },
          Escape: { href: selectedId ? newHref : "/dashboard" },
        }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <ListPageHeader
          title="매입관리 > 구매 견적요청"
          actions={
            <>
              <Link href={newHref} className="erp-btn erp-btn-primary">
                F2 견적요청 작성
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

      <DateRangeQuickFilters basePath="/purchase-quote-requests" presets={presets} monthButtons={monthButtons} from={from} to={to} />

      <form method="get" id="purchase-quote-requests-search-form" className="erp-field-grid">
        <div className="erp-field erp-span-2">
          <label htmlFor="pqr-search-from">시작일</label>
          <input id="pqr-search-from" type="date" name="from" defaultValue={from ?? ""} className="erp-input" />
        </div>
        <div className="erp-field erp-span-2">
          <label htmlFor="pqr-search-to">종료일</label>
          <input id="pqr-search-to" type="date" name="to" defaultValue={to ?? ""} className="erp-input" />
        </div>
        <div className="erp-field erp-span-6">
          <label htmlFor="pqr-search-q">매입처 / 메모 검색</label>
          <input
            id="pqr-search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="매입처명, 메모"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(from || to || q || limitParam) && (
          <Link href="/purchase-quote-requests" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>견적요청 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>총 {formatNumber(rows.length)}건</span>
          </div>
          <div className="erp-split-list-body">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={rowHref(r.id)}
                className={`erp-split-list-row${r.id === selectedId ? " active" : ""}`}
              >
                {r.target_supplier_ids.map((sid) => supplierNameById.get(sid) ?? "-").join(", ")}
                <span style={{ marginLeft: 6 }}>
                  <GridBadge tone={r.status === "closed" ? "ok" : "warn"}>
                    {r.status === "closed" ? "확정완료" : "비교중"}
                  </GridBadge>
                </span>
                <div className="erp-split-list-row-sub">
                  품목 {(r.purchase_quote_request_items ?? []).length}건 · {r.request_date.replaceAll("-", ".")}
                  {r.selected_supplier?.name ? ` · 확정: ${r.selected_supplier.name}` : ""}
                  {r.converted_purchase_request_id ? " · 구매요청 전환됨" : ""}
                </div>
              </Link>
            ))}
            {rows.length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                조건에 맞는 견적요청이 없습니다.
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
            <PurchaseQuoteRequestDetailPanel key={selectedId} id={selectedId} closeHref={newHref} />
          ) : (
            formData && (
              <NewPurchaseQuoteRequestForm today={todayKstStr()} suppliers={formData.suppliers} products={formData.products} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
