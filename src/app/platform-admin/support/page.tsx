import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { PageGuide } from "@/components/erp/page-guide";
import { ListPageHeader } from "@/components/erp/page-header";
import { SupportTicketListBody } from "@/components/support-ticket-list-body";

export default async function PlatformSupportPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("id, doc_no, subject, message, status, reply, created_at, tenants(name)")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (tickets ?? []).map((t) => ({
    id: t.id,
    doc_no: t.doc_no,
    subject: t.subject,
    message: t.message,
    status: t.status,
    reply: t.reply,
    created_at: t.created_at,
    tenantName: (t.tenants as { name: string } | null)?.name ?? "-",
  }));

  return (
    <div>
      <ListPageHeader eyebrow="플랫폼 관리" title="고객지원" />
      <PageGuide>
        전체 테넌트가 남긴 문의입니다. 왼쪽에서 회사를 고르면 그 회사 문의만 걸러서 보고, 답변을
        등록하면 해당 회사의 환경설정 &gt; 고객지원 화면에 바로 표시됩니다.
      </PageGuide>

      {error ? (
        <p className="text-sm" style={{ color: "var(--erp-danger)" }}>
          조회에 실패했습니다: {error.message}
        </p>
      ) : (
        <SupportTicketListBody tickets={rows} />
      )}
    </div>
  );
}
