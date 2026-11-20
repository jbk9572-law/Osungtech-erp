import { formatKstDate } from "@/lib/kst-date";
import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { PageGuide } from "@/components/erp/page-guide";
import { GridBadge } from "@/components/grid/badge";
import { OfficialDocumentDetailPanel } from "@/components/official-document-detail-panel";
import { SplitDetailEmpty, SplitListFiller } from "@/components/erp/page-header";
import { GuardedLink } from "@/components/erp/guarded-link";
import { SplitFilterColumn } from "@/components/erp/split-filter-column";
import { DocumentIcon } from "@/components/erp/groupware-icons";
import { fetchAllRows, fetchAllRowsIn } from "@/lib/fetch-all-rows";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";
import { resolveStatusLabel } from "@/lib/status-label";

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
// 모던 테마(grid-modern) 전용 B형 공문함 — 필터 열(공문함·상태) | 목록 | 상세, 새 공문은 C형 모달. 클래식은 classic.tsx(동결본).
export async function OfficialDocumentsList({ box, id, status: statusParam }: { box: "mine" | "received"; id?: string; status?: string }) {
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "official_documents");
  const user = await getUser();
  const selectedId = id && isUuid(id) ? id : undefined;
  const status = statusParam && statusParam in STATUS_LABEL ? statusParam : "all";

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
      ? (
          await fetchAllRowsIn(ids, (idChunk, from, to) =>
            supabase
              .from("official_documents")
              .select("id, title, status, doc_no, doc_no_year, disclosure, created_at")
              .in("id", idChunk)
              .order("created_at", { ascending: false })
              .range(from, to),
          )
        ).sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)) // 나눠 받았으므로 전체 기준 최신순으로 다시 정렬
      : [];
  }

  const boxHref = TABS.find((t) => t.key === box)?.href ?? "/official-documents";
  const statusKeys = Object.keys(STATUS_LABEL);
  const visible = status === "all" ? rows : rows.filter((r) => r.status === status);
  const withStatus = (p: URLSearchParams) => (p.toString() ? `${boxHref}?${p.toString()}` : boxHref);
  const filterParams = new URLSearchParams();
  if (status !== "all") filterParams.set("status", status);
  const rowHref = (docId: string) => {
    const p = new URLSearchParams(filterParams);
    p.set("id", docId);
    return withStatus(p);
  };
  const listHref = withStatus(filterParams);
  const statusHref = (key: string) => (key === "all" ? boxHref : `${boxHref}?status=${key}`);

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts shortcuts={{ F2: { href: "/official-documents/new" }, Escape: { href: selectedId ? listHref : "/dashboard" } }} />
      <div className="erp-page-toolbar erp-detail-header-row">
        <h1 className="erp-h1">공문관리 &gt; {TABS.find((t) => t.key === box)?.label}</h1>
        <div className="erp-toolbar erp-u-mb-0">
          <GuardedLink href="/official-documents/new" className="erp-btn erp-btn-primary">
            F2 새 공문
          </GuardedLink>
          {selectedId && (
            <Link href={listHref} className="erp-btn">
              목록
            </Link>
          )}
        </div>
      </div>

      <PageGuide>
        결재까지는 전자결재와 같은 결재선을 타고, 결재가 끝나면 문서번호가 부여됩니다. 발송은 이메일 주소가 있는 수신처는 자동 발송을 시도하고, 그 외에는 직접 발송 처리로 기록합니다.
      </PageGuide>

      <div className="erp-split3-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <SplitFilterColumn
          ariaLabel="공문 필터"
          groups={[
            { heading: "공문함", items: TABS.map((t) => ({ key: t.key, label: t.label, active: box === t.key, href: t.href })) },
            {
              heading: "상태",
              items: [{ key: "all", label: "전체", count: rows.length }, ...statusKeys.map((k) => ({ key: k, label: STATUS_LABEL[k].label, count: rows.filter((r) => r.status === k).length }))].map((it) => ({
                ...it,
                active: status === it.key,
                href: statusHref(it.key),
              })),
            },
          ]}
        />

        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>공문 목록</span>
            <span className="erp-u-muted erp-u-normal">총 {formatNumber(visible.length)}건</span>
          </div>
          <div className="erp-split-list-body">
            {visible.map((row) => {
              const st = resolveStatusLabel(STATUS_LABEL, row.status);
              return (
                <Link key={row.id} href={rowHref(row.id)} className={`erp-split-list-row${row.id === selectedId ? " active" : ""}`}>
                  {row.title}
                  <span className="erp-u-ml-s2">
                    <GridBadge tone={st.tone}>{st.label}</GridBadge>
                  </span>
                  <div className="erp-split-list-row-sub">
                    {row.doc_no ? `${row.doc_no_year}-${row.doc_no}` : "번호 미부여"} · {DISCLOSURE_LABEL[row.disclosure] ?? row.disclosure} · {formatKstDate(row.created_at)}
                  </div>
                </Link>
              );
            })}
            <SplitListFiller
              icon={<DocumentIcon />}
              title={visible.length === 0 ? "공문이 없습니다" : "새 공문을 작성해보세요"}
              actionHref="/official-documents/new"
              actionLabel="F2 새 공문"
            />
          </div>
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <OfficialDocumentDetailPanel id={selectedId} closeHref={listHref} selfHref={`${listHref}${listHref.includes("?") ? "&" : "?"}id=${selectedId}`} />
          ) : (
            <SplitDetailEmpty icon={<DocumentIcon />} title="공문을 선택해주세요" hint="왼쪽 목록에서 공문을 누르면 여기에 내용이 표시됩니다. 새 공문은 [F2 새 공문]으로 작성합니다." />
          )}
        </div>
      </div>
    </div>
  );
}
