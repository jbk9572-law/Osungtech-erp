import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { AccessWall } from "@/components/erp/access-wall";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { AnnouncementForm } from "@/components/announcement-form";
import { createAnnouncement } from "@/app/(dashboard)/announcements/actions";

// 새 공지 입력 화면 — 목록 옆 인라인 작성 대신 C형 모달/전용 화면으로 연다. 작성은 관리자/매니저만.
export default async function NewAnnouncementPage() {
  const { isManagerOrAdmin } = await getCurrentActor(await createClient());
  if (!isManagerOrAdmin) {
    return <AccessWall title="공지사항 > 새 공지" message="공지사항 작성은 관리자/매니저만 할 수 있습니다." backHref="/announcements" />;
  }
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/announcements" } }} />
      <ListPageHeader title="공지사항 > 새 공지" />
      <AnnouncementForm action={createAnnouncement} submitLabel="등록" />
    </div>
  );
}
