import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteButton } from "@/components/delete-button";
import { AnnouncementForm } from "@/components/announcement-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { deleteAnnouncement, markAnnouncementRead, updateAnnouncement } from "../actions";

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("announcements")
    .select("id, title, content, pinned, created_at, profiles!created_by(full_name)")
    .eq("id", id)
    .maybeSingle();

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

  try {
    await markAnnouncementRead(row.id);
  } catch {
    // 읽음 처리 실패는 화면 표시에 영향을 주지 않도록 무시한다.
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/announcements" } }} />
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">공지사항 &gt; 수정</h1>

      <div className="erp-toolbar">
        <Link href="/announcements" className="erp-btn">
          ESC 목록으로
        </Link>
        <DeleteButton action={deleteAnnouncement} id={row.id} confirmMessage="이 공지사항을 삭제하시겠습니까?" />
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">{row.title}</span>
        </div>
        <div className="erp-detail-body">
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "var(--erp-text-muted)" }}>
            <span>작성자: {row.profiles?.full_name ?? "-"}</span>
            <span>작성일: {new Date(row.created_at).toLocaleDateString("ko-KR")}</span>
          </div>
          <AnnouncementForm
            action={updateAnnouncement}
            submitLabel="수정"
            initial={{ id: row.id, title: row.title, content: row.content, pinned: row.pinned }}
          />
        </div>
      </div>
    </div>
  );
}
