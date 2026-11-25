import { createClient } from "@/lib/supabase/server";
import { RecordPageA } from "@/components/grid/record-page-a";
import type { RecordRow } from "@/components/grid/record-list-a";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { NextActionCheckbox } from "@/components/next-action-checkbox";
import { getQuickDatePresets, getYearMonthButtons } from "@/lib/date-presets";
import { matchesSearch } from "@/lib/search-match";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayKstStr } from "@/lib/kst-date";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

// 모던 테마(grid-modern) 전용 A형 영업활동관리 — 표 + 오른쪽 상세 패널, 신규·수정은 C형 모달. 클래식은 classic.tsx(동결본).
export default async function SalesActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; q?: string; limit?: string }>;
}) {
  const { from, to, q, limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;

  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "crm");
  const today = todayKstStr();

  const keyword = q?.trim().toLowerCase();

  const buildQuery = () => {
    let query = supabase
      .from("sales_activities")
      .select(
        "id, activity_type, subject, content, activity_date, next_action_date, next_action_memo, next_action_done, customers(id, name)",
      )
      .order("activity_date", { ascending: false });
    if (from) query = query.gte("activity_date", from);
    if (to) query = query.lte("activity_date", to);
    return query;
  };

  // "팔로우업 예정"은 위 목록의 조회기간 필터와 무관하게 항상 전체에서
  // 아직 처리 안 한 건을 보여준다 — 날짜로 목록을 좁혀도 놓치는 팔로우업이
  // 없어야 하므로 별도 쿼리로 둔다.
  //
  // 검색어(q)가 있으면 화면에 보이는 limit건 안에서만 찾지 않고 조회기간
  // 전체에서 찾는다 — sales/purchases 목록과 같은 이유로 같은 버그가
  // 있었다(사용자 지적 — "작성자가 다른 건은 조회가 안 된다").
  const [rawActivities, { data: upcomingRows }] = await Promise.all([
    keyword
      ? fetchAllRows((from, to) => buildQuery().range(from, to).order("id", { ascending: true }))
      : buildQuery()
          .limit(limit)
          .then((r) => r.data ?? []),
    supabase
      .from("sales_activities")
      .select("id, subject, next_action_date, next_action_memo, customers(name)")
      .eq("next_action_done", false)
      .not("next_action_date", "is", null)
      .order("next_action_date", { ascending: true })
      .limit(50),
  ]);

  const hasMore = !keyword && rawActivities.length >= limit;
  const activities = keyword
    ? rawActivities.filter((a) => matchesSearch(keyword, a.customers?.name, a.subject, a.content))
    : rawActivities;

  const upcoming = upcomingRows ?? [];

  const presets = getQuickDatePresets();
  const monthButtons = getYearMonthButtons();

  const listParams = new URLSearchParams();
  if (from) listParams.set("from", from);
  if (to) listParams.set("to", to);
  if (q) listParams.set("q", q);
  const moreParams = new URLSearchParams(listParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/sales-activities?${moreParams.toString()}`;

  const rows: RecordRow[] = activities.map((a) => {
    const date = a.activity_date.replaceAll("-", ".");
    const customer = a.customers?.name ?? "-";
    return {
      id: a.id,
      href: `/sales-activities/${a.id}`,
      cells: [date, customer, <GridBadge key="t" tone="muted">{a.activity_type}</GridBadge>, a.subject, a.next_action_date ? a.next_action_date.replaceAll("-", ".") : "-"],
      values: [a.activity_date, customer, a.activity_type, a.subject, a.next_action_date],
      card: {
        title: (
          <>
            <span className="erp-row-card-partner">{customer}</span>
            <GridBadge tone="muted">{a.activity_type}</GridBadge>
          </>
        ),
        sub: `${a.subject} · ${date}`,
      },
      panel: {
        title: customer,
        subtitle: `${date} · ${a.activity_type}`,
        kv: [
          { label: "제목", value: a.subject },
          { label: "내용", value: a.content || "-" },
          { label: "다음 일정", value: a.next_action_date ? `${a.next_action_date.replaceAll("-", ".")}${a.next_action_done ? " (완료)" : ""}` : "-" },
          { label: "다음 메모", value: a.next_action_memo || "-" },
        ],
        actions: [{ label: "수정·상세", href: `/sales-activities/${a.id}` }],
      },
    };
  });


  const filters = (
    <>
      <PageGuide>
        거래처별 상담/방문/전화 이력을 기록하고, 다음 팔로우업 예정일을 정해두면 여기서 한눈에 챙길 수 있습니다.
      </PageGuide>



      {upcoming.length > 0 && (
        <details className="erp-fold-section">
          <summary>
            팔로우업 예정 <b>{upcoming.length}건</b>
            {upcoming.some((a) => a.next_action_date! < today) && <span className="erp-u-danger"> · 지남 {upcoming.filter((a) => a.next_action_date! < today).length}건</span>}
          </summary>
          <div className="erp-grid-wrap">
              <table className="erp-grid">
                <thead>
                  <tr>
                    <th className="erp-col-m">예정일</th>
                    <th className="erp-col-xl">거래처</th>
                    <th>메모</th>
                    <th className="erp-col-s">완료</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((a) => {
                    const overdue = a.next_action_date! < today;
                    return (
                      <tr key={a.id}>
                        <td className={overdue ? "erp-u-danger erp-u-bold" : undefined}>
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
        </details>
      )}
    </>
  );

  return (
    <RecordPageA
      title="영업활동관리"
      basePath="/sales-activities"
      newLabel="새 활동 기록"
      searchFormId="sales-activities-search-form"
      filters={filters}
      filterBar={{ from, to, q, searchPlaceholder: "거래처명, 제목, 내용", presets, monthButtons, showReset: !!(from || to || q || limitParam) }}
      columns={[{ label: "활동일" }, { label: "거래처" }, { label: "유형" }, { label: "제목" }, { label: "다음 일정" }]}
      rows={rows}
      panelAriaLabel="선택한 영업활동 상세"
      hasMore={hasMore}
      moreHref={moreHref}
      moreStep={LIST_LIMIT_STEP}
      emptyMessage="조건에 맞는 활동 기록이 없습니다."
    />
  );
}
