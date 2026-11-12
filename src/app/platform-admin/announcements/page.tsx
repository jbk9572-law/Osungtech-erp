import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { ListPageHeader } from "@/components/erp/page-header";
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
      <ListPageHeader eyebrow="플랫폼 관리" title="공지사항" />
      <PageGuide>
        여기 등록한 공지는 개별 회사의 자체 공지사항과 별개로, 노출 중(사용)으로 켜둔 항목이 모든
        회사의 모든 사용자 대시보드 상단에 배너로 보입니다.
      </PageGuide>

      <div className="erp-detail erp-u-mt-0 erp-u-mb-s5">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">새 공지 등록</span>
        </div>
        <div className="erp-detail-body">
          <CreatePlatformAnnouncementForm />
        </div>
      </div>

      {!announcements?.length ? (
        <p className="erp-grid-empty">등록된 공지가 없습니다.</p>
      ) : (
        <div className="erp-card-feed erp-card-feed-compact">
          {announcements.map((a) => (
            <div className="erp-u-flex erp-u-items-center erp-u-justify-between erp-u-gap-s5 erp-u-bg-panel erp-u-flex-none"
              key={a.id}
              style={{ border: "1px solid var(--erp-comm-border)", borderRadius: "var(--erp-comm-radius-row)", boxShadow: "var(--erp-comm-shadow-row)", padding: "13px 18px" }}
            >
              <div className="erp-u-minw-0">
                <div className="erp-u-semibold erp-u-text erp-u-text-md">{a.title}</div>
                <div className="erp-u-muted erp-u-text-sm erp-u-mt-3">
                  {a.content ?? "-"} · {new Date(a.created_at).toLocaleDateString("ko-KR")}
                </div>
              </div>
              <div className="erp-u-flex erp-u-items-center erp-u-gap-10 erp-u-flex-none">
                <PlatformAnnouncementActiveCheckbox id={a.id} isActive={a.is_active} title={a.title} />
                <DeleteButton action={deletePlatformAnnouncement} id={a.id} confirmMessage="이 공지를 삭제하시겠습니까?" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
