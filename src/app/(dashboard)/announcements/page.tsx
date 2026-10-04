import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { AnnouncementListBody, isThisWeek, type AnnouncementRow } from "@/components/announcement-list-body";
import { AnnouncementDetailPanel } from "@/components/announcement-detail-panel";
import { AnnouncementForm } from "@/components/announcement-form";
import { FormSection } from "@/components/erp/page-header";
import { createAnnouncement } from "@/app/(dashboard)/announcements/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; id?: string }>;
}) {
  const { limit: limitParam, id } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const supabase = await createClient();
  const user = await getUser();

  const [{ rows, hasMore }, summaryRows, readRows] = await Promise.all([
    fetchLimitedRows<{
      id: string;
      title: string;
      content: string | null;
      pinned: boolean;
      created_at: string;
      profiles: { full_name: string | null } | null;
    }>(
      (from, to) =>
        supabase
          .from("announcements")
          .select("id, title, content, pinned, created_at, profiles!created_by(full_name)")
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, to),
      limit,
    ),
    // 요약카드(전체/고정/이번주)는 목록 표시 limit과 무관하게 전체 공지
    // 기준으로 보여준다 — todos 목록의 summaryRows와 같은 이유("최근 N건만
    // 보이는데 전체 건수가 줄어보인다" 같은 혼란을 피하기 위함).
    fetchAllRows<{ id: string; pinned: boolean; created_at: string }>((from, to) =>
      supabase.from("announcements").select("id, pinned, created_at").range(from, to),
    ),
    // 이 사용자가 읽은 공지 전체 — 이 개수는 이 사용자가 실제로 읽은
    // 공지 수를 넘을 수 없어 announcements 테이블 자체와 비슷하게
    // 유계이므로, fetchAllRows로 페이지네이션해서 안전하게 전부 가져온다.
    // (지금 화면에 보이는 것만 가져오면 "안읽음" 요약이 목록 limit 밖의
    // 안 읽은 공지를 놓쳐 실제보다 적게 표시된다.)
    user
      ? fetchAllRows<{ announcement_id: string }>((from, to) =>
          supabase
            .from("announcement_reads")
            .select("announcement_id")
            .eq("user_id", user.id)
            .range(from, to),
        )
      : Promise.resolve([] as { announcement_id: string }[]),
  ]);

  const readIds = new Set(readRows.map((r) => r.announcement_id));
  const gridRows: AnnouncementRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    createdAt: row.created_at,
    authorName: row.profiles?.full_name ?? null,
    read: readIds.has(row.id),
  }));

  const totalCount = summaryRows.length;
  const unreadCount = summaryRows.filter((r) => !readIds.has(r.id)).length;
  const pinnedCount = summaryRows.filter((r) => r.pinned).length;
  const thisWeekCount = summaryRows.filter((r) => isThisWeek(r.created_at)).length;

  const newHref = limitParam ? `/announcements?limit=${limitParam}` : "/announcements";
  const rowHref = (annId: string) => `${newHref}${newHref.includes("?") ? "&" : "?"}id=${annId}`;
  const moreHref = `/announcements?limit=${limit + LIST_LIMIT_STEP}`;

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{ F2: { href: newHref }, Escape: { href: selectedId ? newHref : "/dashboard" } }}
      />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">공지사항</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={newHref} className="erp-btn erp-btn-primary">
            F2 글쓰기
          </Link>
          {selectedId && (
            <Link href={newHref} className="erp-btn">
              목록
            </Link>
          )}
        </div>
      </div>

      <div className="erp-kpi-row" style={{ marginBottom: 12 }}>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">전체 공지</div>
          <div className="erp-kpi-value">{formatNumber(totalCount)}건</div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">안읽음</div>
          <div className="erp-kpi-value" style={{ color: unreadCount ? "var(--erp-danger)" : undefined }}>
            {formatNumber(unreadCount)}건
          </div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">고정 공지</div>
          <div className="erp-kpi-value" style={{ color: "var(--erp-primary)" }}>
            {formatNumber(pinnedCount)}건
          </div>
        </div>
        <div className="erp-home-panel erp-kpi-card">
          <div className="erp-kpi-label">이번주 등록</div>
          <div className="erp-kpi-value">{formatNumber(thisWeekCount)}건</div>
        </div>
      </div>

      <div className="erp-split3-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <AnnouncementListBody
          rows={gridRows}
          selectedId={selectedId}
          rowHref={rowHref}
          limit={limit}
          hasMore={hasMore}
          moreHref={moreHref}
        />

        <div className="erp-split-detail">
          {selectedId ? (
            <AnnouncementDetailPanel id={selectedId} closeHref={newHref} />
          ) : (
            <FormSection tabLabel="공지사항 작성">
              <AnnouncementForm action={createAnnouncement} submitLabel="등록" />
            </FormSection>
          )}
        </div>
      </div>
    </div>
  );
}
