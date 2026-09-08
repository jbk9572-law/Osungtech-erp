import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  AnnouncementGridTable,
  isThisWeek,
  type AnnouncementRow,
} from "@/components/announcement-grid-table";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const { limit: limitParam } = await searchParams;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{ F2: { href: "/announcements/new" }, Escape: { href: "/dashboard" } }}
      />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">공지사항</h1>

      <div className="erp-toolbar">
        <Link href="/announcements/new" className="erp-btn erp-btn-primary">
          F2 글쓰기
        </Link>
        <Link href="/dashboard" className="erp-btn erp-btn-danger">
          ESC 닫기
        </Link>
      </div>

      <div
        className="rounded p-2 text-xs"
        style={{
          marginBottom: 8,
          background: "var(--erp-info-bg)",
          color: "var(--erp-info-text)",
          border: "1px solid var(--erp-info-border)",
        }}
      >
        최근 {limit.toLocaleString()}건까지 표시 중{hasMore ? " — 더 있을 수 있습니다." : "."}
      </div>

      <AnnouncementGridTable
        rows={gridRows}
        totalCount={totalCount}
        unreadCount={unreadCount}
        pinnedCount={pinnedCount}
        thisWeekCount={thisWeekCount}
      />

      {hasMore && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Link href={`/announcements?limit=${limit + LIST_LIMIT_STEP}`} className="erp-btn">
            더보기 (다음 {LIST_LIMIT_STEP.toLocaleString()}건)
          </Link>
        </div>
      )}
    </div>
  );
}
