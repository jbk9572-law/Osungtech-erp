import { createClient, getUser } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { RichTextView } from "@/components/erp/rich-text-view";
import { GridBadge } from "@/components/grid/badge";
import { AccessWall } from "@/components/erp/access-wall";
import { SupportTicketForm } from "@/components/support-ticket-form";
import { createSupportTicket } from "@/app/(dashboard)/settings/support/actions";
import { resolveStatusLabel } from "@/lib/status-label";

// TODO_CS_AUTOMATION: 저가형 요금제 특성상 "비밀번호 재설정", "용량이
// 부족해요" 같은 반복 문의가 늘어날 수 있다. 전부 이 운영자 문의 화면
// (사람이 직접 답변)으로만 받기보다, FAQ 위주의 인앱 가이드나 챗봇/
// 카카오 채널 연동형 도움말 센터를 먼저 보여주고 거기서 해결이 안 될
// 때만 여기로 넘어오게 하는 구조를 검토할 것.
const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "muted" }> = {
  open: { label: "답변 대기", tone: "warn" },
  answered: { label: "답변 완료", tone: "ok" },
  closed: { label: "종료", tone: "muted" },
};

export default async function SupportPage() {
  const supabase = await createClient();
  const user = await getUser();
  const { isManagerOrAdmin } = await getCurrentActor(supabase);

  if (!isManagerOrAdmin) {
    return (
      <AccessWall
        title="환경설정 > 운영자 문의"
        message="운영자 문의는 관리자/매니저만 작성·조회할 수 있습니다."
        backHref="/dashboard"
      />
    );
  }

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, doc_no, subject, message, status, reply, replied_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <ListPageHeader title="환경설정 > 운영자 문의" />
      <PageGuide>
        서비스 이용 중 궁금한 점이나 문제가 있으면 아래에 남겨주세요. 플랫폼 운영자가 확인 후 답변을
        등록하면 이 화면에 그대로 표시됩니다. 회사를 대표해 운영자와 소통하는 채널이라 관리자/매니저만
        쓸 수 있습니다.
      </PageGuide>

      <FormSection tabLabel="문의 등록">
        <SupportTicketForm action={createSupportTicket} />
      </FormSection>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">문의 이력</span>
        </div>
        <div className="erp-detail-body">
          {!user ? null : (tickets ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
              등록한 문의가 없습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {(tickets ?? []).map((t) => {
                const status = resolveStatusLabel(STATUS_LABEL, t.status);
                return (
                  <div key={t.id} className="rounded border p-3" style={{ borderColor: "var(--erp-border)" }}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">
                        #{t.doc_no} {t.subject}
                      </span>
                      <GridBadge tone={status.tone}>{status.label}</GridBadge>
                    </div>
                    {/* message/reply는 스마트에디터(리치텍스트)로 작성된 HTML이다 — RichTextView가
                        렌더링 전에 서버에서 한 번 더 걸러낸다. */}
                    <RichTextView
                      html={t.message}
                      className="erp-richtext-content mb-2 text-xs"
                      style={{ padding: "10px 0", color: "var(--erp-text-muted)" }}
                    />
                    {t.reply && (
                      <PageGuide className="mb-0">
                        <strong>운영자 답변</strong>
                        <RichTextView html={t.reply} className="erp-richtext-content mt-1" style={{ padding: "8px 0 0" }} />
                      </PageGuide>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
