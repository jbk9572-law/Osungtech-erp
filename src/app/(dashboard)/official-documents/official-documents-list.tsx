import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { OfficialDocumentDetailPanel } from "@/components/official-document-detail-panel";
import { OfficialDocumentForm } from "@/components/official-document-form";
import { createOfficialDocument } from "@/app/(dashboard)/official-documents/actions";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";

const STATUS_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info" }> = {
  draft: { label: "작성중", tone: "muted" },
  pending_approval: { label: "결재중", tone: "warn" },
  approved: { label: "승인(발송대기)", tone: "info" },
  sent: { label: "발송완료", tone: "ok" },
  closed: { label: "종결", tone: "muted" },
  cancelled: { label: "취소", tone: "danger" },
};
const DISCLOSURE_LABEL: Record<string, string> = { public: "공개", partial: "부분공개", private: "비공개" };

const TABS = [
  { key: "mine", label: "내 공문함", href: "/official-documents" },
  { key: "received", label: "받은 공문함", href: "/official-documents/received" },
] as const;

// 내 공문함/받은 공문함 두 화면이 필터 조건만 다르고 목록 UI는
// 똑같아서 공용 서버 컴포넌트로 뺐다 — 각 page.tsx는 box만 다르게 넘긴다.
export async function OfficialDocumentsList({ box, id }: { box: "mine" | "received"; id?: string }) {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "official_documents");
  const user = await getUser();
  const selectedId = id && isUuid(id) ? id : undefined;

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

  const boxHref = TABS.find((t) => t.key === box)?.href ?? "/official-documents";
  const rowHref = (docId: string) => `${boxHref}?id=${docId}`;
  const newHref = boxHref;

  let formData: { templates: { id: string; name: string; body: string }[]; profiles: { id: string; name: string }[] } | null =
    null;
  if (!selectedId) {
    const [templates, profiles] = await Promise.all([
      fetchAllRows<{ id: string; name: string; body: string }>((from, to) =>
        supabase
          .from("document_templates")
          .select("id, name, body")
          .eq("category", "official")
          .eq("is_active", true)
          .order("name")
          .range(from, to),
      ),
      fetchAllRows<{ id: string; full_name: string | null }>((from, to) =>
        supabase.from("profiles").select("id, full_name").order("full_name").range(from, to),
      ),
    ]);
    formData = { templates, profiles: profiles.map((p) => ({ id: p.id, name: p.full_name || "구성원" })) };
  }

  return (
    <div>
      <KeyboardShortcuts shortcuts={{ F2: { href: newHref }, Escape: { href: selectedId ? newHref : "/dashboard" } }} />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="text-lg font-bold text-[var(--erp-text)]">공문관리 &gt; {TABS.find((t) => t.key === box)?.label}</h1>
        <div className="erp-toolbar" style={{ marginBottom: 0 }}>
          <Link href={newHref} className="erp-btn erp-btn-primary">
            F2 새 공문
          </Link>
          {selectedId && (
            <Link href={newHref} className="erp-btn">
              목록
            </Link>
          )}
        </div>
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

      <div className="erp-split-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>공문 목록</span>
            <span style={{ color: "var(--erp-text-muted)", fontWeight: 400 }}>총 {formatNumber(rows.length)}건</span>
          </div>
          <div className="erp-split-list-body">
            {rows.map((row) => {
              const status = STATUS_LABEL[row.status] ?? { label: row.status, tone: "muted" as const };
              return (
                <Link
                  key={row.id}
                  href={rowHref(row.id)}
                  className={`erp-split-list-row${row.id === selectedId ? " active" : ""}`}
                >
                  {row.title}
                  <span style={{ marginLeft: 6 }}>
                    <GridBadge tone={status.tone}>{status.label}</GridBadge>
                  </span>
                  <div className="erp-split-list-row-sub">
                    {row.doc_no ? `${row.doc_no_year}-${row.doc_no}` : "번호 미부여"} ·{" "}
                    {DISCLOSURE_LABEL[row.disclosure] ?? row.disclosure} · {new Date(row.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </Link>
              );
            })}
            {rows.length === 0 && (
              <p className="p-3 text-xs" style={{ color: "var(--erp-text-muted)" }}>
                공문이 없습니다.
              </p>
            )}
          </div>
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <OfficialDocumentDetailPanel id={selectedId} closeHref={newHref} />
          ) : (
            formData && (
              <div className="erp-detail" style={{ marginTop: 0 }}>
                <div className="erp-detail-tabs">
                  <span className="erp-detail-tab active">공문 작성</span>
                </div>
                <div className="erp-detail-body">
                  <OfficialDocumentForm action={createOfficialDocument} templates={formData.templates} profiles={formData.profiles} />
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
