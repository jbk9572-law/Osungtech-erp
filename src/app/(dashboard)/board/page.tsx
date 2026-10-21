import { createClient, getUser } from "@/lib/supabase/server";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { ListPageHeader, SplitDetailEmpty } from "@/components/erp/page-header";
import { PageGuide } from "@/components/erp/page-guide";
import { DocumentIcon } from "@/components/erp/groupware-icons";
import { isFeatureEnabled } from "@/lib/require-feature-enabled";
import { BoardListBody, type BoardCategory, type BoardRow, type BoardWriteLink } from "@/components/board-list-body";
import { AnnouncementDetailPanel } from "@/components/announcement-detail-panel";
import { DocumentDetailPanel } from "@/components/document-detail-panel";
import { OfficialDocumentDetailPanel } from "@/components/official-document-detail-panel";
import { ApprovalDetailPanel } from "@/components/approval-detail-panel";
import { isUuid } from "@/lib/is-uuid";

const PER_CATEGORY_LIMIT = 100;
const CATEGORIES: BoardCategory[] = ["notice", "hr_doc", "official", "approval"];

const HR_DOC_STATUS = {
  issued: { label: "발급완료", tone: "ok" as const },
  draft: { label: "초안", tone: "warn" as const },
};

const OFFICIAL_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info" }> = {
  draft: { label: "작성중", tone: "muted" },
  pending_approval: { label: "결재중", tone: "warn" },
  approved: { label: "승인(발송대기)", tone: "info" },
  sent: { label: "발송완료", tone: "ok" },
  closed: { label: "종결", tone: "muted" },
  cancelled: { label: "취소", tone: "danger" },
};

const APPROVAL_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "muted" | "info" }> = {
  pending: { label: "결재중", tone: "warn" },
  approved: { label: "승인완료", tone: "ok" },
  rejected: { label: "반려", tone: "danger" },
  recalled: { label: "회수됨", tone: "muted" },
};

// 공지사항/인사관리>문서함/공문관리>내공문함·받은공문함/전자결재>기안함 —
// 전부 "확인해야 할 문서 목록"이라는 성격은 같은데 트리메뉴의 4개
// 다른 그룹에 흩어져 있어서 한눈에 훑어보려면 4번 들어가야 했다.
// 각 화면/테이블/RLS/워크플로우는 하나도 안 건드리고, 최근 항목만 모아
// 보여주는 진입점 하나를 새로 만든다.
//
// 예전엔 글을 누르면 각자의 원래 화면(/announcements/[id] 등)으로 아예
// 이동해버려서 "게시판은 훑어보기용, 상세는 딴 데 가서"라는 안내문이
// 따로 필요했다(사용자 지적 — "이건 왜 3분할 디자인 안 한 거야?").
// 메일함/공지사항이 쓰는 것과 같은 .erp-split3-shell(카테고리
// 사이드바+목록+상세) 구조로 바꿔서, 선택한 글의 카테고리에 맞는 상세
// 패널(AnnouncementDetailPanel 등 — 각 화면이 원래 쓰던 것 그대로)을
// 이 화면 안에 바로 꽂아 보여준다. id만으로는 어느 테이블 글인지 알 수
// 없으니 category도 함께 쿼리스트링(?id=&type=)으로 들고 다닌다.
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; type?: string }>;
}) {
  const supabase = await createClient();
  const user = await getUser();
  const { id, type } = await searchParams;

  const [hrEnabled, officialEnabled, approvalsEnabled] = await Promise.all([
    isFeatureEnabled(supabase, "hr"),
    isFeatureEnabled(supabase, "official_documents"),
    isFeatureEnabled(supabase, "approvals"),
  ]);

  const rows: BoardRow[] = [];

  // 4개 섹션은 서로 전혀 무관한 조회라, 이전에는 순서대로(공지→인사→
  // 공문→결재) 하나씩 기다려서 한 화면에 최대 5~6번 Supabase 왕복이
  // 직렬로 걸렸다. 켤지 말지(hrEnabled 등)는 이미 위에서 다 알고 있으니,
  // 섹션별로 함수 하나씩 묶어 Promise.all로 동시에 돌린다 — 각 섹션
  // 내부의 진짜 의존관계(공지→읽음여부, 공문 내문서+수신목록→실제
  // 공문)는 그대로 유지된다.
  const [noticeRows, hrDocRows, officialRows, approvalRows] = await Promise.all([
    // ── 공지사항 (항상 켜져 있는 핵심 기능이라 featureKey 없음) ────────
    (async (): Promise<BoardRow[]> => {
      const { data: notices } = await supabase
        .from("announcements")
        .select("id, title, pinned, created_at")
        .order("created_at", { ascending: false })
        .limit(PER_CATEGORY_LIMIT);
      const noticeIds = (notices ?? []).map((n) => n.id);
      const { data: readRows } =
        user && noticeIds.length
          ? await supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id).in("announcement_id", noticeIds)
          : { data: [] as { announcement_id: string }[] };
      const readIds = new Set((readRows ?? []).map((r) => r.announcement_id));
      return (notices ?? []).map((n) => {
        const unread = !readIds.has(n.id);
        return {
          id: n.id,
          category: "notice" as const,
          title: n.title,
          status: unread ? { label: "안읽음", tone: "danger" as const } : n.pinned ? { label: "고정", tone: "info" as const } : null,
          date: n.created_at,
          href: `/announcements/${n.id}`,
        };
      });
    })(),
    // ── 인사관리 > 문서함 ──────────────────────────────────────────
    hrEnabled
      ? (async (): Promise<BoardRow[]> => {
          // document_instances_select RLS가 이미 "내가 만들었거나 나에
          // 대한 문서 또는 관리자"로 걸러준다(hr/documents/page.tsx와 동일).
          const { data: hrDocs } = await supabase
            .from("document_instances")
            .select("id, title, status, created_at")
            .order("created_at", { ascending: false })
            .limit(PER_CATEGORY_LIMIT);
          return (hrDocs ?? []).map((d) => ({
            id: d.id,
            category: "hr_doc" as const,
            title: d.title,
            status: HR_DOC_STATUS[d.status as keyof typeof HR_DOC_STATUS] ?? { label: d.status, tone: "muted" as const },
            date: d.created_at,
            href: `/hr/documents/item/${d.id}`,
          }));
        })()
      : Promise.resolve([]),
    // ── 공문관리(내 공문함 + 받은 공문함 합침) ─────────────────────
    officialEnabled && user
      ? (async (): Promise<BoardRow[]> => {
          const [{ data: mineDocs }, { data: recipientRows }] = await Promise.all([
            supabase
              .from("official_documents")
              .select("id, title, status, created_at")
              .eq("created_by", user.id)
              .order("created_at", { ascending: false })
              .limit(PER_CATEGORY_LIMIT),
            supabase.from("official_document_recipients").select("official_document_id").eq("user_id", user.id).limit(PER_CATEGORY_LIMIT),
          ]);
          const receivedIds = Array.from(new Set((recipientRows ?? []).map((r) => r.official_document_id)));
          const { data: receivedDocs } = receivedIds.length
            ? await supabase
                .from("official_documents")
                .select("id, title, status, created_at")
                .in("id", receivedIds)
                .order("created_at", { ascending: false })
                .limit(PER_CATEGORY_LIMIT)
            : { data: [] as { id: string; title: string; status: string; created_at: string }[] };
          const officialById = new Map<string, { id: string; title: string; status: string; created_at: string }>();
          for (const d of [...(mineDocs ?? []), ...(receivedDocs ?? [])]) officialById.set(d.id, d);
          return Array.from(officialById.values()).map((d) => ({
            id: d.id,
            category: "official" as const,
            title: d.title,
            status: OFFICIAL_STATUS[d.status] ?? { label: d.status, tone: "muted" as const },
            date: d.created_at,
            href: `/official-documents/${d.id}`,
          }));
        })()
      : Promise.resolve([]),
    // ── 전자결재 > 기안함(임시저장 제외 — approvals/page.tsx와 동일) ──
    approvalsEnabled
      ? (async (): Promise<BoardRow[]> => {
          const { data: approvalDocs } = await supabase
            .from("approval_documents")
            .select("id, title, status, created_at")
            .neq("status", "draft")
            .order("created_at", { ascending: false })
            .limit(PER_CATEGORY_LIMIT);
          return (approvalDocs ?? []).map((d) => ({
            id: d.id,
            category: "approval" as const,
            title: d.title,
            status: APPROVAL_STATUS[d.status] ?? { label: d.status, tone: "muted" as const },
            date: d.created_at,
            href: `/approvals/${d.id}`,
          }));
        })()
      : Promise.resolve([]),
  ]);
  rows.push(...noticeRows, ...hrDocRows, ...officialRows, ...approvalRows);

  rows.sort((a, b) => b.date.localeCompare(a.date));

  const counts = {
    all: rows.length,
    notice: rows.filter((r) => r.category === "notice").length,
    hr_doc: rows.filter((r) => r.category === "hr_doc").length,
    official: rows.filter((r) => r.category === "official").length,
    approval: rows.filter((r) => r.category === "approval").length,
  };

  // 공지사항/문서함/공문함/기안함을 트리메뉴 독립 항목에서 내리면서
  // (erp-menu.ts) 게시판이 이 4개의 유일한 진입점이 됐다 — 그런데 이
  // 목록은 "이미 있는 글"만 보여줘서 각 화면의 "새로 작성" 진입점(목록
  // 화면 자체에 있음, F2/새 글쓰기 버튼)으로 가는 길이 없어진다. 꺼진
  // 기능은 바로가기도 넣지 않는다 — 꺼진 화면으로 안내하면 안 되므로.
  const writeLinks: BoardWriteLink[] = [
    { category: "notice", label: "새 공지", href: "/announcements" },
    ...(hrEnabled ? [{ category: "hr_doc" as const, label: "새 인사문서", href: "/hr/documents" }] : []),
    ...(officialEnabled ? [{ category: "official" as const, label: "새 공문", href: "/official-documents" }] : []),
    ...(approvalsEnabled ? [{ category: "approval" as const, label: "새 기안", href: "/approvals" }] : []),
  ];

  const listHref = "/board";
  const selectedId = id && isUuid(id) ? id : undefined;
  const selectedType = selectedId && CATEGORIES.includes(type as BoardCategory) ? (type as BoardCategory) : undefined;

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts shortcuts={{ Escape: { href: selectedId ? listHref : "/dashboard" } }} />
      <ListPageHeader title="게시판" />
      <PageGuide>
        공지사항 / 인사문서함 / 공문함 / 결재·기안함의 최근 항목을 한 화면에 모아 보여줍니다. 각 항목은 이 화면 안에서
        바로 확인할 수 있고, 수정·삭제 같은 세부 처리는 원래 메뉴와 완전히 같은 화면을 그대로 씁니다.
      </PageGuide>

      <div className="erp-split3-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <BoardListBody
          rows={rows}
          counts={counts}
          writeLinks={writeLinks}
          selectedId={selectedId}
          selectedType={selectedType}
          basePath={listHref}
        />

        <div className="erp-split-detail">
          {selectedId && selectedType === "notice" && <AnnouncementDetailPanel id={selectedId} closeHref={listHref} />}
          {selectedId && selectedType === "hr_doc" && <DocumentDetailPanel id={selectedId} />}
          {selectedId && selectedType === "official" && <OfficialDocumentDetailPanel id={selectedId} closeHref={listHref} />}
          {selectedId && selectedType === "approval" && <ApprovalDetailPanel id={selectedId} closeHref={listHref} />}
          {!selectedId && (
            <SplitDetailEmpty
              icon={<DocumentIcon />}
              title="글을 선택해주세요"
              hint="왼쪽 목록에서 글을 누르면 여기에 내용이 표시됩니다."
            />
          )}
        </div>
      </div>
    </div>
  );
}
