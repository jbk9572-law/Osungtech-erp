import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { PurchaseRequestDetailPanel } from "@/components/purchase-request-detail-panel";
import { NewPurchaseRequestForm } from "@/components/new-purchase-request-form";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { getQuickDatePresets, getYearMonthButtons } from "@/lib/date-presets";
import { matchesSearch } from "@/lib/search-match";
import { formatNumber } from "@/lib/format-number";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { isUuid } from "@/lib/is-uuid";
import { todayKstStr } from "@/lib/kst-date";

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
  const { from, to, q, limit: limitParam, id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;

  const supabase = await createClient();

  let query = supabase
    .from("purchase_requests")
    .select(
      "id, request_date, status, converted_purchase_order_id, memo, suppliers(name), profiles!requested_by(full_name), purchase_request_items(quantity, estimated_unit_price)",
    )
    .order("request_date", { ascending: false })
    .limit(limit);
  if (from) query = query.gte("request_date", from);
  if (to) query = query.lte("request_date", to);

  const { data: rawRequests } = await query;
  const hasMore = (rawRequests?.length ?? 0) >= limit;

  const keyword = q?.trim().toLowerCase();
  const requests = keyword
    ? (rawRequests ?? []).filter((r) => matchesSearch(keyword, r.suppliers?.name, r.memo, r.profiles?.full_name))
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
    return `/purchase-requests?${p.toString()}`;
  };
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/purchase-requests?${moreParams.toString()}`;
  const newHref = listParams.toString() ? `/purchase-requests?${listParams.toString()}` : "/purchase-requests";

  let formData: {
    suppliers: { id: string; name: string }[];
    products: { id: string; sku: string; name: string; spec: string | null; cost: number }[];
  } | null = null;
  if (!selectedId) {
    const [suppliers, products] = await Promise.all([
      fetchAllRows<{ id: string; name: string }>((f, t) => supabase.from("suppliers").select("id, name").order("name").range(f, t)),
      // 구매(매입) 문맥이라 판매단가(price)가 아니라 매입원가(cost)를
      // 기본 예상단가로 쓴다 — new-purchase-form.tsx와 동일한 기준.
      fetchAllRows<{ id: string; sku: string; name: string; spec: string | null; cost: number }>((f, t) =>
        supabase.from("products").select("id, sku, name, spec, cost").order("name").range(f, t),
      ),
    ]);
    formData = { suppliers, products };
  }

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{ F2: { href: newHref }, F5: { submitFormSelector: "#purchase-requests-search-form" }, Escape: { href: selectedId ? newHref : "/dashboard" } }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <ListPageHeader
          title="매입관리 > 구매요청"
          actions={
            <>
              <Link href={newHref} className="erp-btn erp-btn-primary">
                F2 구매요청 작성
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

      <DateRangeQuickFilters basePath="/purchase-requests" presets={presets} monthButtons={monthButtons} from={from} to={to} />

      <form method="get" id="purchase-requests-search-form" className="erp-search">
        <div className="erp-field">
          <label htmlFor="pr-search-from">시작일</label>
          <input id="pr-search-from" type="date" name="from" defaultValue={from ?? ""} className="erp-input" />
        </div>
        <div className="erp-field">
          <label htmlFor="pr-search-to">종료일</label>
          <input id="pr-search-to" type="date" name="to" defaultValue={to ?? ""} className="erp-input" />
        </div>
        <div className="erp-field" style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="pr-search-q">공급처 / 작성자 / 메모 검색</label>
          <input
            id="pr-search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="공급처명, 작성자, 메모"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(from || to || q || limitParam) && (
          <Link href="/purchase-requests" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>구매요청 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>총 {formatNumber(requests.length)}건</span>
          </div>
          <div className="erp-split-list-body">
            {requests.map((r) => {
              const total = (r.purchase_request_items ?? []).reduce(
                (sum, i) => sum + Number(i.quantity) * Number(i.estimated_unit_price),
                0,
              );
              const status = STATUS_LABEL[r.status] ?? { label: r.status, tone: "muted" as const };
              return (
                <Link
                  key={r.id}
                  href={rowHref(r.id)}
                  className={`erp-split-list-row${r.id === selectedId ? " active" : ""}`}
                >
                  {r.suppliers?.name ?? "-"}
                  <span style={{ marginLeft: 6 }}>
                    <GridBadge tone={status.tone}>{status.label}</GridBadge>
                  </span>
                  <div className="erp-split-list-row-sub">
                    {formatNumber(total)}원 · {r.request_date.replaceAll("-", ".")} · {r.profiles?.full_name ?? "-"}
                    {r.converted_purchase_order_id ? " · 발주전환됨" : ""}
                  </div>
                </Link>
              );
            })}
            {requests.length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                조건에 맞는 구매요청이 없습니다.
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
            <PurchaseRequestDetailPanel id={selectedId} closeHref={newHref} />
          ) : (
            formData && (
              <FormSection tabLabel="구매요청 작성">
                <NewPurchaseRequestForm today={todayKstStr()} suppliers={formData.suppliers} products={formData.products} />
              </FormSection>
            )
          )}
        </div>
      </div>
    </div>
  );
}
