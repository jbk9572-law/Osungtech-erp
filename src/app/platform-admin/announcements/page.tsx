import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { CreatePlatformAnnouncementForm } from "@/components/create-platform-announcement-form";
import { PlatformAnnouncementActiveCheckbox } from "@/components/platform-announcement-active-checkbox";
import { DeleteButton } from "@/components/delete-button";
import { deletePlatformAnnouncement } from "@/app/platform-admin/announcements/actions";

export default async function PlatformAnnouncementsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: announcements } = await supabase
    .from("platform_announcements")
    .select("id, title, content, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">플랫폼 관리 &gt; 공지사항</h1>
      <PageGuide>
        여기 등록한 공지는 개별 회사의 자체 공지사항과 별개로, 노출 중(사용)으로 켜둔 항목이 모든
        회사의 모든 사용자 대시보드 상단에 배너로 보입니다.
      </PageGuide>

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">새 공지 등록</span>
        </div>
        <div className="erp-detail-body">
          <CreatePlatformAnnouncementForm />
        </div>
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th>제목</th>
              <th>내용</th>
              <th style={{ width: 90 }}>노출</th>
              <th style={{ width: 140 }}>등록일</th>
              <th style={{ width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {(announcements ?? []).map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td style={{ color: "var(--erp-text-muted)" }}>{a.content ?? "-"}</td>
                <td>
                  <PlatformAnnouncementActiveCheckbox id={a.id} isActive={a.is_active} title={a.title} />
                </td>
                <td>{new Date(a.created_at).toLocaleDateString("ko-KR")}</td>
                <td>
                  <DeleteButton action={deletePlatformAnnouncement} id={a.id} confirmMessage="이 공지를 삭제하시겠습니까?" />
                </td>
              </tr>
            ))}
            {!announcements?.length && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  등록된 공지가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
