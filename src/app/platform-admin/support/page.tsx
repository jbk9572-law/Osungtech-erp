import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { SupportTicketReplyForm } from "@/components/support-ticket-reply-form";
import { replySupportTicket } from "@/app/platform-admin/support/actions";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "muted" }> = {
  open: { label: "답변 대기", tone: "warn" },
  answered: { label: "답변 완료", tone: "ok" },
  closed: { label: "종료", tone: "muted" },
};

export default async function PlatformSupportPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("id, doc_no, subject, message, status, reply, created_at, tenants(name)")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">플랫폼 관리 &gt; 고객지원</h1>
      <PageGuide>
        전체 테넌트가 남긴 문의입니다. 답변을 등록하면 해당 회사의 환경설정 &gt; 고객지원 화면에 바로
        표시됩니다.
      </PageGuide>

      {error ? (
        <p className="text-sm" style={{ color: "var(--erp-danger)" }}>
          조회에 실패했습니다: {error.message}
        </p>
      ) : (tickets ?? []).length === 0 ? (
        <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
          등록된 문의가 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {(tickets ?? []).map((t) => {
            const status = STATUS_LABEL[t.status] ?? { label: t.status, tone: "muted" as const };
            const tenantName = (t.tenants as { name: string } | null)?.name ?? "-";
            return (
              <div key={t.id} className="rounded border p-3" style={{ borderColor: "var(--erp-border)" }}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">
                    [{tenantName}] #{t.doc_no} {t.subject}
                  </span>
                  <GridBadge tone={status.tone}>{status.label}</GridBadge>
                </div>
                <p className="mb-2 whitespace-pre-line text-xs" style={{ color: "var(--erp-text-muted)" }}>
                  {t.message}
                </p>
                <SupportTicketReplyForm ticketId={t.id} defaultReply={t.reply} action={replySupportTicket} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
