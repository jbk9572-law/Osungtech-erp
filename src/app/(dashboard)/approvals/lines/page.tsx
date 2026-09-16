import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { CloseButton } from "@/components/erp/close-button";
import { InlineConfirmDelete } from "@/components/inline-confirm-delete";
import { deleteApprovalLinePreset } from "@/app/(dashboard)/approvals/lines/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export default async function ApprovalLinePresetsPage() {
  const supabase = await createClient();
  const presets = await fetchAllRows<{
    id: string;
    name: string;
    approver_ids: string[];
    reference_ids: string[];
    profiles: { full_name: string | null } | null;
  }>((from, to) =>
    supabase
      .from("approval_line_presets")
      .select("id, name, approver_ids, reference_ids, profiles!created_by(full_name)")
      .order("name")
      .range(from, to),
  );

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: "/approvals/lines/new" }, Escape: { href: "/approvals" } }} />
      <ListPageHeader
        title="전자결재 > 공유 결재선"
        actions={
          <>
            <Link href="/approvals/lines/new" className="erp-btn erp-btn-primary">
              F2 새 결재선
            </Link>
            <CloseButton href="/approvals">ESC 기안함으로</CloseButton>
          </>
        }
      />

      <PageGuide>
        자주 쓰는 결재선(결재자·참조자 순서 조합)을 이름 붙여 저장해두면,
        새 기안을 쓸 때 조직도를 다시 펼치지 않고 바로 불러와 쓸 수
        있습니다. 결재매트릭스에서 결재양식과 연결해두면 그 양식을 고를
        때 자동으로 제안됩니다.
      </PageGuide>

      {presets.length === 0 ? (
        <p className="erp-grid-empty">등록된 결재선이 없습니다.</p>
      ) : (
        <div className="erp-grid-wrap">
          <table className="erp-grid">
            <thead>
              <tr>
                <th>이름</th>
                <th style={{ width: 90 }}>결재자</th>
                <th style={{ width: 90 }}>참조자</th>
                <th style={{ width: 110 }}>만든이</th>
                <th style={{ width: 140 }} />
              </tr>
            </thead>
            <tbody>
              {presets.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="num">{p.approver_ids.length}명</td>
                  <td className="num">{p.reference_ids.length}명</td>
                  <td>{p.profiles?.full_name ?? "-"}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/approvals/lines/${p.id}/edit`}
                        className="erp-btn"
                        style={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
                      >
                        수정
                      </Link>
                      <InlineConfirmDelete
                        action={deleteApprovalLinePreset}
                        hiddenFields={{ id: p.id }}
                        warningText="이 결재선을 삭제하시겠습니까? 결재매트릭스에 연결돼 있다면 그 규칙도 함께 삭제됩니다."
                        triggerStyle={{ minWidth: 0, height: 24, padding: "0 8px", fontSize: 11 }}
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
