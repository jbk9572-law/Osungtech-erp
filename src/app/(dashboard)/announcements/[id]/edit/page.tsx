import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { canManage } from "@/lib/can-manage";
import { isUuid } from "@/lib/is-uuid";
import { AccessWall } from "@/components/erp/access-wall";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { AnnouncementForm } from "@/components/announcement-form";
import { updateAnnouncement } from "@/app/(dashboard)/announcements/actions";

// 공지 수정 입력 화면 — 상세 패널은 읽기 전용이고, 수정은 이 C형 모달/전용 화면에서 한다. 본인이 쓴 공지(또는 관리자)만.
export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: row }, actor] = await Promise.all([
    supabase.from("announcements").select("id, title, content, pinned, created_by").eq("id", id).maybeSingle(),
    getCurrentActor(supabase),
  ]);
  if (!row) notFound();
  if (!canManage(row.created_by, actor.userId, actor.isAdmin)) {
    return <AccessWall title="공지사항 > 수정" message="본인이 등록한 공지사항만 수정할 수 있습니다." backHref={`/announcements?id=${id}`} />;
  }
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: `/announcements?id=${id}` } }} />
      <ListPageHeader title="공지사항 > 수정" />
      <AnnouncementForm action={updateAnnouncement} submitLabel="수정" initial={{ id: row.id, title: row.title, content: row.content, pinned: row.pinned }} />
    </div>
  );
}
