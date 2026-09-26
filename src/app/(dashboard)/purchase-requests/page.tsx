import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { ClickableRow } from "@/components/clickable-row";
import { GridBadge, type BadgeTone } from "@/components/grid/badge";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { getQuickDatePresets, getYearMonthButtons } from "@/lib/date-presets";
import { matchesSearch } from "@/lib/search-match";

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
  searchParams: Promise<{ from?: string; to?: string; q?: string; limit?: string }>;
}) {
  const { from, to, q, limit: limitParam } = await searchParams;
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
    : rawRequests;

  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();
  const moreParams = new URLSearchParams();
  if (from) moreParams.set("from", from);
  if (to) moreParams.set("to", to);
  if (q) moreParams.set("q", q);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/purchase-requests?${moreParams.toString()}`;

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: "/purchase-requests/new" },
          F5: { submitFormSelector: "#purchase-requests-search-form" },
          Escape: { href: "/dashboard" },
        }}
      />
      <ListPageHeader
        title="매입관리 > 구매요청"
        actions={
          <Link href="/purchase-requests/new" className="erp-btn erp-btn-primary">
            F2 구매요청 작성
          </Link>
        }
      />

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

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 90 }}>요청일</th>
              <th style={{ width: 160 }}>공급처</th>
              <th className="num" style={{ width: 70 }}>품목 수</th>
              <th className="num" style={{ width: 120 }}>예상합계</th>
              <th style={{ width: 90 }}>작성자</th>
              <th style={{ width: 90 }}>상태</th>
              <th style={{ width: 90 }}>발주전환</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {(requests ?? []).map((r) => {
              const total = (r.purchase_request_items ?? []).reduce(
                (sum, i) => sum + Number(i.quantity) * Number(i.estimated_unit_price),
                0,
              );
              const status = STATUS_LABEL[r.status] ?? { label: r.status, tone: "muted" as const };
              return (
                <ClickableRow key={r.id} href={`/purchase-requests/${r.id}`}>
                  <td>{r.request_date.replaceAll("-", ".")}</td>
                  <td>{r.suppliers?.name ?? "-"}</td>
                  <td className="num">{(r.purchase_request_items ?? []).length}</td>
                  <td className="num">{total.toLocaleString()}</td>
                  <td>{r.profiles?.full_name ?? "-"}</td>
                  <td>
                    <GridBadge tone={status.tone}>{status.label}</GridBadge>
                  </td>
                  <td>{r.converted_purchase_order_id ? "전환됨" : "-"}</td>
                  <td style={{ color: "var(--erp-text-muted)" }}>{r.memo ?? "-"}</td>
                </ClickableRow>
              );
            })}
            {(!requests || requests.length === 0) && (
              <tr>
                <td colSpan={8} className="erp-grid-empty">
                  조건에 맞는 구매요청이 없습니다.
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
