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

      <div className="erp-detail" style={{ marginTop: 0, marginBottom: "var(--erp-space-5)" }}>
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
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--erp-space-5)",
                background: "var(--erp-panel)",
                border: "1px solid var(--erp-comm-border)",
                borderRadius: "var(--erp-comm-radius-row)",
                boxShadow: "var(--erp-comm-shadow-row)",
                padding: "13px 18px",
                flex: "0 0 auto",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "var(--erp-font-md)", fontWeight: 600, color: "var(--erp-text)" }}>{a.title}</div>
                <div style={{ fontSize: "var(--erp-font-sm)", color: "var(--erp-text-muted)", marginTop: 3 }}>
                  {a.content ?? "-"} · {new Date(a.created_at).toLocaleDateString("ko-KR")}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
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
