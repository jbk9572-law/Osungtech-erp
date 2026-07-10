import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClickableRow } from "@/components/clickable-row";
import { AnnouncementCheckbox } from "@/components/announcement-checkbox";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: rows, error }, { data: reads }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, pinned, created_at, profiles!created_by(full_name)")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
    user
      ? supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { announcement_id: string }[] }),
  ]);

  const readIds = new Set((reads ?? []).map((r) => r.announcement_id));

  return (
    <div>
      <KeyboardShortcuts
        shortcuts={{ F2: { href: "/announcements/new" }, Escape: { href: "/dashboard" } }}
      />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">공지사항</h1>

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

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 40 }}>읽음</th>
              <th style={{ width: 60 }}>구분</th>
              <th>제목</th>
              <th style={{ width: 140 }}>작성자</th>
              <th style={{ width: 120 }}>작성일</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => {
              const read = readIds.has(row.id);
              return (
                <ClickableRow key={row.id} href={`/announcements/${row.id}`}>
                  <td style={{ textAlign: "center" }}>
                    <AnnouncementCheckbox id={row.id} read={read} />
                  </td>
                  <td style={{ textAlign: "center" }}>{row.pinned ? "📌" : ""}</td>
                  <td style={!read ? { fontWeight: 700 } : { color: "var(--erp-text-muted)" }}>
                    {row.title}
                  </td>
                  <td>{row.profiles?.full_name ?? "-"}</td>
                  <td>{new Date(row.created_at).toLocaleDateString("ko-KR")}</td>
                </ClickableRow>
              );
            })}
            {!rows?.length && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  등록된 공지사항이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
