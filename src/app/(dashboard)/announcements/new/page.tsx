import { AnnouncementForm } from "@/components/announcement-form";
import { createAnnouncement } from "@/app/(dashboard)/announcements/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { AccessWall } from "@/components/erp/access-wall";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";

export default async function NewAnnouncementPage() {
  const supabase = await createClient();
  const { isManagerOrAdmin } = await getCurrentActor(supabase);

  if (!isManagerOrAdmin) {
    return <AccessWall title="공지사항 > 글쓰기" message="공지사항 작성은 관리자/매니저만 할 수 있습니다." />;
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/announcements" } }} />
      <h1 className="mb-3 text-lg font-bold text-[var(--erp-text)]">공지사항 &gt; 글쓰기</h1>

      <div className="erp-toolbar">
        <CloseButton href="/announcements">ESC 목록으로</CloseButton>
      </div>

      <div className="erp-detail" style={{ marginTop: 0 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">공지사항 작성</span>
        </div>
        <div className="erp-detail-body">
          <AnnouncementForm action={createAnnouncement} submitLabel="등록" />
        </div>
      </div>
    </div>
  );
}
