import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { SupportTicketForm } from "@/components/support-ticket-form";
import { createSupportTicket } from "@/app/(dashboard)/settings/support/actions";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "muted" }> = {
  open: { label: "답변 대기", tone: "warn" },
  answered: { label: "답변 완료", tone: "ok" },
  closed: { label: "종료", tone: "muted" },
};

export default async function SupportPage() {
  const supabase = await createClient();
  const user = await getUser();

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
        등록하면 이 화면에 그대로 표시됩니다.
      </PageGuide>

      <FormSection tabLabel="문의 등록">
        <SupportTicketForm action={createSupportTicket} />
      </FormSection>

      <div className="erp-detail">
        <div className="erp-detail-tabs">
          <span className="erp-detail-tab active">내 문의 이력</span>
        </div>
        <div className="erp-detail-body">
          {!user ? null : (tickets ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
              등록한 문의가 없습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {(tickets ?? []).map((t) => {
                const status = STATUS_LABEL[t.status] ?? { label: t.status, tone: "muted" as const };
                return (
                  <div key={t.id} className="rounded border p-3" style={{ borderColor: "var(--erp-border)" }}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">
                        #{t.doc_no} {t.subject}
                      </span>
                      <GridBadge tone={status.tone}>{status.label}</GridBadge>
                    </div>
                    <p className="mb-2 whitespace-pre-line text-xs" style={{ color: "var(--erp-text-muted)" }}>
                      {t.message}
                    </p>
                    {t.reply && (
                      <div
                        className="rounded p-2 text-xs"
                        style={{ background: "var(--erp-info-bg)", color: "var(--erp-info-text)", border: "1px solid var(--erp-info-border)" }}
                      >
                        <strong>운영자 답변</strong>
                        <p className="mt-1 whitespace-pre-line">{t.reply}</p>
                      </div>
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
