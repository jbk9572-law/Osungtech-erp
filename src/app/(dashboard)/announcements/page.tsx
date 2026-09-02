import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementGridTable, type AnnouncementRow } from "@/components/announcement-grid-table";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows, error } = await supabase
    .from("announcements")
    .select("id, title, content, pinned, created_at, profiles!created_by(full_name)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);

  // 안 읽음 여부는 지금 목록에 보여줄 것들에 대해서만 필요하므로, 그 id로만
  // 좁혀서 조회한다 — 이 사용자가 지금까지 읽은 공지 전체를 가져오면 오래
  // 쓸수록(1000건 초과 시) 조용히 잘려서 최근 글의 읽음 여부가 틀릴 수 있다.
  const rowIds = (rows ?? []).map((r) => r.id);
  const { data: reads } =
    user && rowIds.length
      ? await supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id).in("announcement_id", rowIds)
      : { data: [] as { announcement_id: string }[] };

  const readIds = new Set((reads ?? []).map((r) => r.announcement_id));
  const gridRows: AnnouncementRow[] = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    createdAt: row.created_at,
    authorName: row.profiles?.full_name ?? null,
    read: readIds.has(row.id),
  }));

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

      {error && (
        <p className="erp-grid-empty" style={{ marginBottom: 12 }}>
          목록을 불러오지 못했습니다: {error.message}
        </p>
      )}

      <AnnouncementGridTable rows={gridRows} />
    </div>
  );
}
