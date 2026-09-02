import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { AnnouncementForm } from "@/components/announcement-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { deleteAnnouncement, updateAnnouncement } from "../actions";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { GridBadge } from "@/components/grid/badge";

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: row, error }, actor] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, content, pinned, created_at, created_by, profiles!created_by(full_name)")
      .eq("id", id)
      .maybeSingle(),
    getCurrentActor(supabase),
  ]);

  if (error) {
    return (
      <div className="erp-grid-empty" style={{ padding: 24 }}>
        공지사항을 불러오지 못했습니다: {error.message}
      </div>
    );
  }

  if (!row) {
    notFound();
  }

  const allowManage = canManage(row.created_by, actor.userId, actor.isAdmin);

  // 목록의 "안읽음" 체크박스를 따로 눌러야만 읽음 처리가 되고, 정작 이
  // 상세 화면에서 내용을 다 읽어도 읽음으로 남지 않던 문제 — 알림종/대시보드
  // 배지가 이미 읽은 공지도 계속 안읽음으로 보여줬다. 상세 화면을 열람하는
  // 것 자체를 읽음 처리로 본다.
  if (actor.userId) {
    const { error: markReadError } = await supabase
      .from("announcement_reads")
      .upsert({ announcement_id: id, user_id: actor.userId }, { onConflict: "announcement_id,user_id" });
    if (markReadError) {
      console.error("공지 읽음 처리 실패:", markReadError.message);
    }
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/announcements" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">
        공지사항 &gt; {allowManage ? "수정" : "상세"}
      </h1>

      <div className="erp-toolbar">
        <Link href="/announcements" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
        {allowManage && (
          <DeleteButton action={deleteAnnouncement} id={row.id} confirmMessage="이 공지사항을 삭제하시겠습니까?" />
        )}
      </div>

      <div className="erp-post-header">
        {row.pinned && (
          <GridBadge tone="info">고정</GridBadge>
        )}
        <div className="erp-post-title">{row.title}</div>
        <div className="erp-post-byline">
          <span className="erp-avatar">{row.profiles?.full_name?.trim()?.[0] ?? "?"}</span>
          {row.profiles?.full_name ?? "-"} · {new Date(row.created_at).toLocaleDateString("ko-KR")}
        </div>
      </div>
      <div className="erp-post-body">
        {allowManage ? (
          <AnnouncementForm
            action={updateAnnouncement}
            submitLabel="수정"
            initial={{ id: row.id, title: row.title, content: row.content, pinned: row.pinned }}
          />
        ) : (
          <div>
            <p
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 13.5,
                lineHeight: 1.7,
                color: "var(--erp-text)",
                margin: 0,
              }}
            >
              {row.content || "-"}
            </p>
            <p
              className="mt-4 text-xs"
              style={{ color: "var(--erp-text-muted)" }}
            >
              본인이 등록한 공지사항만 수정할 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
