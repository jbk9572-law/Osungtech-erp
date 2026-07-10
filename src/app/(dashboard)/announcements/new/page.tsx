import Link from "next/link";
import { AnnouncementForm } from "@/components/announcement-form";
import { createAnnouncement } from "@/app/(dashboard)/announcements/actions";

export default function NewAnnouncementPage() {
  return (
    <div>
      <h1 className="mb-3 text-lg font-bold text-[#1c1c1c]">공지사항 &gt; 글쓰기</h1>

      <div className="erp-toolbar">
        <Link href="/announcements" className="erp-btn erp-btn-danger">
          ESC 목록으로
        </Link>
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
