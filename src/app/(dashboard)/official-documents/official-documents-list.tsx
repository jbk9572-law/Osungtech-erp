import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { ClickableRow } from "@/components/clickable-row";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info" }> = {
  draft: { label: "작성중", tone: "muted" },
  pending_approval: { label: "결재중", tone: "warn" },
  approved: { label: "승인(발송대기)", tone: "info" },
  sent: { label: "발송완료", tone: "ok" },
  closed: { label: "종결", tone: "muted" },
  cancelled: { label: "취소", tone: "danger" },
};

const TABS = [
  { key: "mine", label: "내 공문함", href: "/official-documents" },
  { key: "received", label: "받은 공문함", href: "/official-documents/received" },
] as const;

// 내 공문함/받은 공문함 두 화면이 필터 조건만 다르고 목록 UI는
// 똑같아서 공용 서버 컴포넌트로 뺐다 — 각 page.tsx는 box만 다르게 넘긴다.
export async function OfficialDocumentsList({ box }: { box: "mine" | "received" }) {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "official_documents");
  const user = await getUser();

  let rows: {
    id: string;
    title: string;
    status: string;
    doc_no: number | null;
    doc_no_year: number | null;
    disclosure: string;
    created_at: string;
  }[] = [];

  if (box === "mine") {
    rows = await fetchAllRows((from, to) =>
      supabase
        .from("official_documents")
        .select("id, title, status, doc_no, doc_no_year, disclosure, created_at")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
  } else {
    const recipientRows = await fetchAllRows<{ official_document_id: string }>((from, to) =>
      supabase
        .from("official_document_recipients")
        .select("official_document_id")
        .eq("user_id", user!.id)
        .range(from, to),
    );
    const ids = Array.from(new Set(recipientRows.map((r) => r.official_document_id)));
    rows = ids.length
      ? await fetchAllRows((from, to) =>
          supabase
            .from("official_documents")
            .select("id, title, status, doc_no, doc_no_year, disclosure, created_at")
            .in("id", ids)
            .order("created_at", { ascending: false })
            .range(from, to),
        )
      : [];
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ Escape: { href: "/dashboard" } }} />
      <div className="mb-1 erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">공문관리 &gt; {TABS.find((t) => t.key === box)?.label}</h1>
        <Link href="/official-documents/new" className="erp-btn erp-btn-primary">
          + 새 공문
        </Link>
      </div>

      <PageGuide>
        결재까지는 전자결재와 같은 결재선을 타고, 결재가 끝나면 문서번호가
        부여됩니다. 발송은 이메일 주소가 있는 수신처는 자동 발송을
        시도하고, 그 외에는 직접 발송 처리로 기록합니다.
      </PageGuide>

      <div className="erp-detail-tabs" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} className={`erp-detail-tab${box === t.key ? " active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="erp-grid-wrap">
        <table className="erp-grid">
          <thead>
            <tr>
              <th style={{ width: 90 }}>문서번호</th>
              <th>제목</th>
              <th style={{ width: 90 }}>공개구분</th>
              <th style={{ width: 120 }}>상태</th>
              <th style={{ width: 110 }}>작성일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = STATUS_LABEL[row.status] ?? { label: row.status, tone: "muted" as const };
              return (
                <ClickableRow key={row.id} href={`/official-documents/${row.id}`}>
                  <td>{row.doc_no ? `${row.doc_no_year}-${row.doc_no}` : "-"}</td>
                  <td>{row.title}</td>
                  <td>{row.disclosure === "public" ? "공개" : row.disclosure === "partial" ? "부분공개" : "비공개"}</td>
                  <td>
                    <GridBadge tone={status.tone}>{status.label}</GridBadge>
                  </td>
                  <td>{new Date(row.created_at).toLocaleDateString("ko-KR")}</td>
                </ClickableRow>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="erp-grid-empty">
                  공문이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
