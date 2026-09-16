import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor } from "@/lib/current-actor";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { deleteTemplate } from "@/app/(dashboard)/hr/documents/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";

const CATEGORY_LABELS: Record<string, string> = {
  hr_contract: "인사 · 계약서",
  hr_certificate: "인사 · 증명서",
  approval: "전자결재 서식",
  general: "기타",
};

export default async function DocumentTemplatesPage() {
  const supabase = await createClient();
  const { isAdmin } = await getCurrentActor(supabase);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 문서 양식 관리</h1>
        <p className="erp-grid-empty" style={{ marginTop: 24 }}>
          이 화면은 관리자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const templates = await fetchAllRows<{
    id: string;
    name: string;
    category: string;
    is_active: boolean;
  }>((from, to) =>
    supabase.from("document_templates").select("id, name, category, is_active").order("category").range(from, to),
  );

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/hr/documents/templates/new" }, Escape: { href: "/hr/documents" } }} />
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">인사관리 &gt; 문서 양식 관리</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href="/hr/documents/templates/new" className="erp-btn erp-btn-primary">
            F2 새 양식
          </Link>
          <Link href="/hr/documents" className="erp-btn erp-btn-dark">
            ESC 문서함으로
          </Link>
        </div>
      </div>

      <PageGuide>
        근로계약서 등 법정 서식은 고용노동부가 배포하는 공식 양식 문구를
        그대로 붙여넣어 등록해주세요 — 직접 새로 작성한 문구를 법적
        서식으로 쓰면 리스크가 있습니다. {"{{필드명}}"} 자리마다 문서
        생성 시 입력값으로 채워집니다.
      </PageGuide>

      {templates.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--erp-text-muted)" }}>
          등록된 양식이 없습니다.
        </p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th style={{ width: 140 }}>분류</th>
                <th>양식 이름</th>
                <th style={{ width: 90 }}>상태</th>
                <th style={{ width: 130 }} />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{CATEGORY_LABELS[t.category] ?? t.category}</td>
                  <td>{t.name}</td>
                  <td>
                    <GridBadge tone={t.is_active ? "ok" : "muted"}>{t.is_active ? "사용중" : "미사용"}</GridBadge>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <Link
                        href={`/hr/documents/templates/${t.id}/edit`}
                        className="erp-btn"
                        style={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
                      >
                        수정
                      </Link>
                      <InlineConfirmDelete
                        action={deleteTemplate}
                        hiddenFields={{ id: t.id }}
                        warningText="이 양식을 삭제하시겠습니까? 이미 생성된 문서는 남습니다."
                        triggerStyle={{ minWidth: 0, height: 24, padding: "1px 8px", fontSize: 11 }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
