import { createClient } from "@/lib/supabase/server";
import { GenerateDocumentForm } from "@/components/generate-document-form";
import { createDocument } from "@/app/(dashboard)/hr/documents/actions";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { CloseButton } from "@/components/erp/close-button";
import { ListPageHeader, FormSection } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function NewDocumentPage() {
  const supabase = await createClient();

  const [templates, profileRows, { data: company }] = await Promise.all([
    fetchAllRows<{ id: string; name: string; body: string }>((from, to) =>
      supabase
        .from("document_templates")
        .select("id, name, body")
        .eq("is_active", true)
        .order("name")
        .range(from, to),
    ),
    fetchAllRows<{
      id: string;
      full_name: string | null;
      position_title: string | null;
      hire_date: string | null;
      departments: { name: string } | null;
    }>((from, to) =>
      supabase
        .from("profiles")
        .select("id, full_name, position_title, hire_date, departments(name)")
        .order("full_name")
        .range(from, to),
    ),
    supabase.from("company_profile").select("name, representative_name").maybeSingle(),
  ]);

  // 재직증명서 등 기본 양식이 소속/직위/입사일을 자동으로 채우려면 이
  // 형태(department_name 평평한 필드)가 필요하다 — document-template.ts
  // AUTO_FILL_FIELD_KEYS 참고.
  const employees = profileRows.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    position_title: p.position_title,
    hire_date: p.hire_date,
    department_name: p.departments?.name ?? null,
  }));

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/hr/documents" } }} />
      <ListPageHeader
        title="인사관리 > 문서함 > 새 문서"
        actions={<CloseButton href="/hr/documents">ESC 목록으로</CloseButton>}
      />

      <PageGuide>
        양식을 고르면 그 안에 있는 병합필드 입력칸이 나타납니다. 대상
        직원을 고르면 직원명 등 알아볼 수 있는 필드는 자동으로
        채워집니다(수정 가능).
      </PageGuide>

      {templates.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
          사용 가능한 양식이 없습니다. 문서 양식 관리에서 먼저 등록해주세요.
        </p>
      ) : (
        <FormSection tabLabel="문서 생성">
          <GenerateDocumentForm
            action={createDocument}
            templates={templates}
            employees={employees}
            companyName={company?.name ?? null}
            representativeName={company?.representative_name ?? null}
          />
        </FormSection>
      )}
    </div>
  );
}
