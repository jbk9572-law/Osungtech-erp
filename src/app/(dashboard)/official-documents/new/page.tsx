import { createClient } from "@/lib/supabase/server";
import { OfficialDocumentForm } from "@/components/official-document-form";
import { createOfficialDocument } from "@/app/(dashboard)/official-documents/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

// 새 공문 작성(C형 모달 내용) — 목록과 같은 기능(official_documents) 사용 여부를 직접 접근에서도 확인한다.
export default async function NewOfficialDocumentPage() {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "official_documents");
  const [templates, profiles] = await Promise.all([
    fetchAllRows<{ id: string; name: string; body: string }>((from, to) =>
      supabase.from("document_templates").select("id, name, body").eq("category", "official").eq("is_active", true).order("name").range(from, to),
    ),
    fetchAllRows<{ id: string; full_name: string | null }>((from, to) => supabase.from("profiles").select("id, full_name").order("full_name").range(from, to)),
  ]);
  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/official-documents" } }} />
      <ListPageHeader title="공문관리 &gt; 새 공문" actions={<CloseButton href="/official-documents">ESC 목록으로</CloseButton>} />
      <PageGuide>
        결재까지는 전자결재와 같은 결재선을 타고, 결재가 끝나면 문서번호가 부여됩니다. 발송은 이메일 주소가 있는 수신처는 자동 발송을 시도하고, 그 외에는 직접 발송 처리로 기록합니다.
      </PageGuide>
      <FormSection tabLabel="공문 작성">
        <OfficialDocumentForm action={createOfficialDocument} templates={templates} profiles={profiles.map((p) => ({ id: p.id, name: p.full_name || "구성원" }))} />
      </FormSection>
    </div>
  );
}
