import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { SalesActivityForm } from "@/components/sales-activity-form";
import { SalesActivityDetailPanel } from "@/components/sales-activity-detail-panel";
import { NextActionCheckbox } from "@/components/next-action-checkbox";
import { DateRangeQuickFilters } from "@/components/erp/date-range-quick-filters";
import { getQuickDatePresets, getYearMonthButtons } from "@/lib/date-presets";
import { matchesSearch } from "@/lib/search-match";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { isUuid } from "@/lib/is-uuid";
import { todayKstStr } from "@/lib/kst-date";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { formatNumber } from "@/lib/format-number";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function SalesActivitiesPage({
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
  const today = todayKstStr();

  let query = supabase
    .from("sales_activities")
    .select(
      "id, activity_type, subject, content, activity_date, next_action_date, next_action_memo, next_action_done, customers(id, name)",
    )
    .order("activity_date", { ascending: false })
    .limit(limit);
  if (from) query = query.gte("activity_date", from);
  if (to) query = query.lte("activity_date", to);

  // "팔로우업 예정"은 위 목록의 조회기간 필터와 무관하게 항상 전체에서
  // 아직 처리 안 한 건을 보여준다 — 날짜로 목록을 좁혀도 놓치는 팔로우업이
  // 없어야 하므로 별도 쿼리로 둔다.
  const [{ data: rawActivities }, { data: upcomingRows }, customers] = await Promise.all([
    query,
    supabase
      .from("sales_activities")
      .select("id, subject, next_action_date, next_action_memo, customers(name)")
      .eq("next_action_done", false)
      .not("next_action_date", "is", null)
      .order("next_action_date", { ascending: true })
      .limit(50),
    !selectedId
      ? fetchAllRows<{ id: string; name: string }>((f, t) =>
          supabase.from("customers").select("id, name").order("name").range(f, t),
        )
      : Promise.resolve<{ id: string; name: string }[]>([]),
  ]);

  const hasMore = (rawActivities?.length ?? 0) >= limit;
  const keyword = q?.trim().toLowerCase();
  const activities = keyword
    ? (rawActivities ?? []).filter((a) => matchesSearch(keyword, a.customers?.name, a.subject, a.content))
    : rawActivities ?? [];

  const upcoming = upcomingRows ?? [];

  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();

  const listParams = new URLSearchParams();
  if (from) listParams.set("from", from);
  if (to) listParams.set("to", to);
  if (q) listParams.set("q", q);
  const rowHref = (activityId: string) => {
    const p = new URLSearchParams(listParams);
    p.set("id", activityId);
    return `/sales-activities?${p.toString()}`;
  };
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/sales-activities?${moreParams.toString()}`;
  const newHref = listParams.toString() ? `/sales-activities?${listParams.toString()}` : "/sales-activities";

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{
          F2: { href: newHref },
          F5: { submitFormSelector: "#sales-activities-search-form" },
          Escape: { href: selectedId ? newHref : "/dashboard" },
        }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <ListPageHeader
          title="영업활동관리"
          actions={
            <>
              <Link href={newHref} className="erp-btn erp-btn-primary">
                F2 새 활동 기록
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

      <PageGuide>
        거래처별 상담/방문/전화 이력을 기록하고, 다음 팔로우업 예정일을 정해두면 여기서 한눈에 챙길 수 있습니다.
      </PageGuide>

      {upcoming.length > 0 && (
        <div className="erp-detail" style={{ marginBottom: 12 }}>
          <div className="erp-detail-tabs">
            <span className="erp-detail-tab active">팔로우업 예정 ({upcoming.length}건)</span>
          </div>
          <div className="erp-detail-body">
            <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>예정일</th>
                    <th style={{ width: 140 }}>거래처</th>
                    <th>메모</th>
                    <th style={{ width: 70 }}>완료</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((a) => {
                    const overdue = a.next_action_date! < today;
                    return (
                      <tr key={a.id}>
                        <td style={{ color: overdue ? "var(--erp-danger)" : "var(--erp-text)", fontWeight: overdue ? 700 : 400 }}>
                          {a.next_action_date!.replaceAll("-", ".")}
                          {overdue && " (지남)"}
                        </td>
                        <td>{a.customers?.name ?? "-"}</td>
                        <td>{a.next_action_memo || a.subject}</td>
                        <td>
                          <NextActionCheckbox id={a.id} done={false} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <DateRangeQuickFilters basePath="/sales-activities" presets={presets} monthButtons={monthButtons} from={from} to={to} />

      <form method="get" id="sales-activities-search-form" className="erp-field-grid">
        <div className="erp-field erp-span-2">
          <label htmlFor="sa-search-from">시작일</label>
          <input id="sa-search-from" type="date" name="from" defaultValue={from ?? ""} className="erp-input" />
        </div>
        <div className="erp-field erp-span-2">
          <label htmlFor="sa-search-to">종료일</label>
          <input id="sa-search-to" type="date" name="to" defaultValue={to ?? ""} className="erp-input" />
        </div>
        <div className="erp-field erp-span-6">
          <label htmlFor="sa-search-q">거래처 / 제목 / 내용 검색</label>
          <input
            id="sa-search-q"
            type="text"
            name="q"
            autoComplete="off"
            defaultValue={q ?? ""}
            placeholder="거래처명, 제목, 내용"
            className="erp-input"
            style={{ width: "100%" }}
          />
        </div>
        <button type="submit" className="erp-btn erp-btn-primary">
          F5 조회
        </button>
        {(from || to || q || limitParam) && (
          <Link href="/sales-activities" className="erp-btn">
            초기화
          </Link>
        )}
      </form>

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>활동 이력</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>총 {formatNumber(activities.length)}건</span>
          </div>
          <div className="erp-split-list-body">
            {activities.map((a) => (
              <Link
                key={a.id}
                href={rowHref(a.id)}
                className={`erp-split-list-row${a.id === selectedId ? " active" : ""}`}
              >
                {a.customers?.name ?? "-"}
                <span style={{ marginLeft: 6 }}>
                  <GridBadge tone="muted">{a.activity_type}</GridBadge>
                </span>
                <div className="erp-split-list-row-sub">
                  {a.subject} · {a.activity_date.replaceAll("-", ".")}
                </div>
              </Link>
            ))}
            {activities.length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                조건에 맞는 활동 기록이 없습니다.
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
            <SalesActivityDetailPanel id={selectedId} closeHref={newHref} />
          ) : (
            <div className="erp-detail" style={{ marginTop: 0 }}>
              <div className="erp-detail-tabs">
                <span className="erp-detail-tab active">새 활동 기록</span>
              </div>
              <div className="erp-detail-body">
                <SalesActivityForm today={today} customers={customers} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
