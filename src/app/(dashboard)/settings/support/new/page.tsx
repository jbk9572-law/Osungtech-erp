import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { AccessWall } from "@/components/erp/access-wall";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { SupportTicketForm } from "@/components/support-ticket-form";
import { createSupportTicket } from "@/app/(dashboard)/settings/support/actions";

// 운영자 문의 등록 입력 화면 — 목록 위 인라인 폼 대신 C형 모달/전용 화면으로 연다.
export default async function NewSupportTicketPage() {
  const { isManagerOrAdmin } = await getCurrentActor(await createClient());
  if (!isManagerOrAdmin) {
    return <AccessWall title="환경설정 > 운영자 문의" message="운영자 문의는 관리자/매니저만 작성·조회할 수 있습니다." backHref="/settings/support" />;
  }
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/settings/support" } }} />
      <ListPageHeader title="환경설정 > 운영자 문의 > 새 문의" />
      <SupportTicketForm action={createSupportTicket} />
    </div>
  );
}
