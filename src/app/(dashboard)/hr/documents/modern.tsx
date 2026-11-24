import { NewButton } from "@/components/erp/list-toolbar";
import { formatKstDate } from "@/lib/kst-date";
import { createClient } from "@/lib/supabase/server";
import { GuardedLink } from "@/components/erp/guarded-link";
import Link from "next/link";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { SplitDetailEmpty, SplitListFiller, ListTitleBar } from "@/components/erp/page-header";
import { SplitFilterColumn, type SplitFilterGroup } from "@/components/erp/split-filter-column";
import { DocumentIcon } from "@/components/erp/groupware-icons";
import { GridBadge } from "@/components/grid/badge";
import { DocumentDetailPanel } from "@/components/document-detail-panel";
import { requireFeatureEnabled } from "@/lib/require-feature-enabled";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";

// 모던 테마(grid-modern) 전용 B형 문서함 — 필터 열(상태·분류) | 목록 | 상세, 새 문서는 C형 모달. 클래식은 classic.tsx(동결본).
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ id?: string; status?: string; category?: string }> }) {
  const { id, status: statusParam, category: categoryParam } = await searchParams;
  const selectedId = id && isUuid(id) ? id : undefined;
  const status = statusParam === "draft" || statusParam === "issued" ? statusParam : "all";
  const category = categoryParam && categoryParam.length <= 60 ? categoryParam : "all";
  const supabase = await createClient();
  await requireFeatureEnabled(supabase, "hr");

  // document_instances_select RLS가 이미 "내가 만들었거나 나에 대한 문서 또는 관리자"로 걸러준다. 화면에도 상한을 둔다.
  const { data } = await supabase
    .from("document_instances")
    .select("id, title, category, status, created_at, profiles!subject_user_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const docs = data ?? [];

  const categories = [...new Set(docs.map((d) => d.category).filter((c): c is string => !!c))];
  const catCount = (c: string) => docs.filter((d) => d.category === c).length;
  const visible = docs.filter((d) => (status === "all" || d.status === (status === "issued" ? "issued" : "draft")) && (category === "all" || d.category === category));

  const filterParams = new URLSearchParams();
  if (status !== "all") filterParams.set("status", status);
  if (category !== "all") filterParams.set("category", category);
  const withParams = (p: URLSearchParams) => (p.toString() ? `/hr/documents?${p.toString()}` : "/hr/documents");
  const filterHref = (key: "status" | "category", value: string) => {
    const p = new URLSearchParams(filterParams);
    if (value === "all") p.delete(key);
    else p.set(key, value);
    return withParams(p);
  };
  const rowHref = (docId: string) => {
    const p = new URLSearchParams(filterParams);
    p.set("id", docId);
    return withParams(p);
  };
  const listHref = withParams(filterParams);

  const groups: SplitFilterGroup[] = [
    {
      heading: "상태",
      items: [
        { key: "all", label: "전체", count: docs.length },
        { key: "draft", label: "초안", count: docs.filter((d) => d.status !== "issued").length },
        { key: "issued", label: "발급완료", count: docs.filter((d) => d.status === "issued").length },
      ].map((it) => ({ ...it, active: status === it.key, href: filterHref("status", it.key) })),
    },
    ...(categories.length
      ? [
          {
            heading: "분류",
            items: [{ key: "all", label: "전체", count: docs.length }, ...categories.map((c) => ({ key: c, label: c, count: catCount(c) }))].map((it) => ({
              ...it,
              active: category === it.key,
              href: filterHref("category", it.key),
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts shortcuts={{ F2: { href: "/hr/documents/new" }, Escape: { href: selectedId ? listHref : "/dashboard" } }} />
      <ListTitleBar
        title={<>그룹웨어 &gt; 문서함</>}
        actions={
          <>
          <NewButton href="/hr/documents/new">새 문서</NewButton>
          <Link href="/hr/documents/templates" className="erp-btn">
            양식 관리
          </Link>
          {selectedId && (
            <Link href={listHref} className="erp-btn">
              목록
            </Link>
          )}
          </>
        }
      />

      <div className="erp-split3-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <SplitFilterColumn ariaLabel="문서 필터" groups={groups} />

        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>문서 목록</span>
            <span className="erp-u-muted erp-u-normal">총 {formatNumber(visible.length)}건</span>
          </div>
          <div className="erp-split-list-body">
            {visible.map((d) => (
              <Link key={d.id} href={rowHref(d.id)} className={`erp-split-list-row${d.id === selectedId ? " active" : ""}`}>
                {d.title}
                <span className="erp-u-ml-s2">
                  <GridBadge tone={d.status === "issued" ? "ok" : "warn"}>{d.status === "issued" ? "발급완료" : "초안"}</GridBadge>
                </span>
                <div className="erp-split-list-row-sub">
                  {formatKstDate(d.created_at)}
                  {d.profiles?.full_name ? ` · ${d.profiles.full_name}` : ""}
                </div>
              </Link>
            ))}
            <SplitListFiller
              icon={<DocumentIcon />}
              title={visible.length === 0 ? "조건에 맞는 문서가 없습니다" : "새 문서를 만들어보세요"}
              actionHref="/hr/documents/new"
              actionLabel="새 문서"
            />
          </div>
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <DocumentDetailPanel key={selectedId} id={selectedId} />
          ) : (
            <SplitDetailEmpty icon={<DocumentIcon />} title="문서를 선택해주세요" hint="왼쪽 목록에서 문서를 누르면 여기에 내용이 표시됩니다. 새 문서는 [새 문서]로 만듭니다." />
          )}
        </div>
      </div>
    </div>
  );
}
