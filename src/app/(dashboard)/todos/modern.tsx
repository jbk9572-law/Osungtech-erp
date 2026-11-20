// 모던 테마(grid-modern) 전용 B형 화면 — 클래식은 classic.tsx(동결본).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TodoCheckbox } from "@/components/todo-checkbox";
import { TodoDetailPanel } from "@/components/todo-detail-panel";
import { GuardedLink } from "@/components/erp/guarded-link";
import { ListSearchForm } from "@/components/erp/list-search-form";
import { KeyboardShortcuts } from "@/components/erp/keyboard-shortcuts";
import { todayKstStr } from "@/lib/kst-date";
import { GridBadge } from "@/components/grid/badge";
import { fetchAllRows, fetchLimitedRows } from "@/lib/fetch-all-rows";
import { matchesSearch } from "@/lib/search-match";
import { isUuid } from "@/lib/is-uuid";
import { formatNumber } from "@/lib/format-number";
import { PageGuide } from "@/components/erp/page-guide";
import { SplitDetailEmpty, ListTitleBar } from "@/components/erp/page-header";
import { CheckCircleIcon } from "@/components/erp/groupware-icons";
import { SplitFilterColumn, type SplitFilterGroup } from "@/components/erp/split-filter-column";

const DEFAULT_LIST_LIMIT = 300;
const LIST_LIMIT_STEP = 300;

type TodoItemInput = {
  productId: string;
  spec?: string | null;
  quantity: number;
};

// 품목이 여러 개면 매입/매출 목록과 동일하게 "대표 품목 외 N건"으로 요약한다.
// items에는 productId만 있고 상품명이 없어서, 목록 화면에서 한 번만 상품
// 전체를 불러와 이름을 붙인다.
function summarizeItems(
  items: TodoItemInput[],
  productNameById: Map<string, string>,
): string {
  if (items.length === 0) return "-";
  const firstName = productNameById.get(items[0].productId) ?? "상품 미상";
  return items.length > 1 ? `${firstName} 외 ${items.length - 1}건` : firstName;
}

export default async function TodosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; warning?: string; limit?: string; id?: string; status?: string; type?: string; owner?: string }>;
}) {
  const { q, warning, limit: limitParam, id, status: statusParam, type: typeParam, owner: ownerParam } = await searchParams;
  const status = statusParam === "active" || statusParam === "overdue" || statusParam === "done" ? statusParam : "all";
  const type = typeParam === "purchase" || typeParam === "sale" || typeParam === "both" ? typeParam : "all";
  const owner = ownerParam && isUuid(ownerParam) ? ownerParam : "all";
  const selectedId = id && isUuid(id) ? id : undefined;
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIST_LIMIT;
  const supabase = await createClient();
  const [{ rows: allRows, hasMore }, products, summaryRows] =
    await Promise.all([
      fetchLimitedRows<{
        id: string;
        title: string;
        memo: string;
        items: unknown;
        todo_type: string;
        ship_date: string | null;
        purchase_done_at: string | null;
        sale_done_at: string | null;
        due_date: string | null;
        done: boolean;
        created_by: string | null;
        profiles: { full_name: string | null } | null;
        suppliers: { name: string } | null;
        customers: { name: string } | null;
      }>(
        (from, to) =>
          supabase
            .from("todos")
            .select(
              "id, title, memo, items, todo_type, ship_date, purchase_done_at, sale_done_at, due_date, done, created_by, profiles!created_by(full_name), suppliers(name), customers(name)",
            )
            .order("done", { ascending: true })
            .order("due_date", { ascending: true, nullsFirst: false })
            .range(from, to),
        limit,
      ),
      fetchAllRows<{
        id: string;
        sku: string;
        name: string;
        spec: string | null;
        unit: string;
        base_package_qty: number | null;
        cost: number;
        price: number;
      }>((from, to) =>
        supabase
          .from("products")
          .select("id, sku, name, spec, unit, base_package_qty, cost, price")
          .order("name")
          .range(from, to),
      ),
      // 요약카드(전체/진행중/기한초과/완료)는 화면에 보이는 목록이 limit으로
      // 잘려도 항상 실제 전체 건수를 반영해야 한다.
      fetchAllRows<{ done: boolean; due_date: string | null; todo_type: string; created_by: string | null; profiles: { full_name: string | null } | null }>((from, to) =>
        supabase.from("todos").select("done, due_date, todo_type, created_by, profiles!created_by(full_name)").range(from, to),
      ),
    ]);

  const productNameById = new Map(products.map((p) => [p.id, p.name]));
  const todayStr = todayKstStr();

  const keyword = q?.trim().toLowerCase();
  const isOverdue = (r: { done: boolean; due_date: string | null }) => !r.done && !!r.due_date && r.due_date < todayStr;
  const passesFilters = (r: { done: boolean; due_date: string | null; todo_type: string; created_by: string | null }) =>
    (status === "all" || (status === "active" ? !r.done : status === "done" ? r.done : isOverdue(r))) &&
    (type === "all" || r.todo_type === type) &&
    (owner === "all" || r.created_by === owner);
  const filteredRows = allRows.filter(passesFilters);
  const rows = keyword
    ? filteredRows.filter((r) => {
        const items = Array.isArray(r.items) ? (r.items as TodoItemInput[]) : [];
        const itemNames = items.map((item) => productNameById.get(item.productId));
        return matchesSearch(keyword, r.title, r.memo, r.suppliers?.name, r.customers?.name, ...itemNames);
      })
    : filteredRows;

  const totalCount = summaryRows.length;
  const doneCount = summaryRows.filter((r) => r.done).length;
  const overdueCount = summaryRows.filter(
    (r) => !r.done && !!r.due_date && r.due_date < todayStr,
  ).length;
  const inProgressCount = totalCount - doneCount;
  const typeLabels: Record<string, string> = { purchase: "매입", sale: "매출 출고", both: "매입+출고" };
  const typeCounts = new Map<string, number>();
  const ownerCounts = new Map<string, { name: string; count: number }>();
  for (const r of summaryRows) {
    typeCounts.set(r.todo_type, (typeCounts.get(r.todo_type) ?? 0) + 1);
    if (r.created_by) {
      const o = ownerCounts.get(r.created_by) ?? { name: r.profiles?.full_name ?? "이름 없음", count: 0 };
      o.count += 1;
      ownerCounts.set(r.created_by, o);
    }
  }

  const listParams = new URLSearchParams();
  if (q) listParams.set("q", q);
  if (limitParam) listParams.set("limit", limitParam);
  // 필터 열의 현재 선택(상태·유형·담당)은 목록 이동·행 선택·더보기에서도 유지한다.
  const filterParams = new URLSearchParams(listParams);
  if (status !== "all") filterParams.set("status", status);
  if (type !== "all") filterParams.set("type", type);
  if (owner !== "all") filterParams.set("owner", owner);
  const rowHref = (todoId: string) => {
    const p = new URLSearchParams(filterParams);
    p.set("id", todoId);
    return `/todos?${p.toString()}`;
  };
  const moreParams = new URLSearchParams(filterParams);
  moreParams.set("limit", String(limit + LIST_LIMIT_STEP));
  const moreHref = `/todos?${moreParams.toString()}`;
  const newHref = filterParams.toString() ? `/todos?${filterParams.toString()}` : "/todos";
  // 필터 항목 하나만 바꾼 주소 — 나머지 선택은 그대로, 열어 둔 행(id)은 닫는다.
  const filterHref = (key: "status" | "type" | "owner", value: string) => {
    const p = new URLSearchParams(filterParams);
    if (value === "all") p.delete(key);
    else p.set(key, value);
    return p.toString() ? `/todos?${p.toString()}` : "/todos";
  };
  const filterGroups: SplitFilterGroup[] = [
    {
      heading: "상태",
      items: [
        { key: "all", label: "전체", count: totalCount },
        { key: "active", label: "진행중", count: inProgressCount },
        { key: "overdue", label: "기한초과", count: overdueCount },
        { key: "done", label: "완료", count: doneCount },
      ].map((it) => ({ ...it, active: status === it.key, href: filterHref("status", it.key) })),
    },
    {
      heading: "유형",
      items: [
        { key: "all", label: "전체", count: totalCount },
        ...(["purchase", "sale", "both"] as const).map((t) => ({ key: t, label: typeLabels[t], count: typeCounts.get(t) ?? 0 })),
      ].map((it) => ({ ...it, active: type === it.key, href: filterHref("type", it.key) })),
    },
    {
      heading: "담당",
      items: [
        { key: "all", label: "전체", count: totalCount },
        ...[...ownerCounts.entries()].sort((a, b) => b[1].count - a[1].count).map(([oid, o]) => ({ key: oid, label: o.name, count: o.count })),
      ].map((it) => ({ ...it, active: owner === it.key, href: filterHref("owner", it.key) })),
    },
  ];

  return (
    <div className="erp-comm-shell">
      <KeyboardShortcuts shortcuts={{ F2: { href: "/todos/new" }, Escape: { href: selectedId ? newHref : "/dashboard" } }} />
      <ListTitleBar
        title={<>할일관리</>}
        actions={
          <>
          <GuardedLink href="/todos/new" className="erp-btn erp-btn-primary">
            F2 새 할일
          </GuardedLink>
          {selectedId && (
            <Link href={newHref} className="erp-btn">
              목록
            </Link>
          )}
          </>
        }
      />

      {warning && (
        <PageGuide tone="warning" className="font-medium">
          ⚠ 할일은 정상 등록됐지만: {warning}
        </PageGuide>
      )}

      <div className="erp-split3-shell" data-mobile-view={selectedId ? "detail" : "list"}>
        <SplitFilterColumn ariaLabel="할일 필터" groups={filterGroups} />
        <section className="erp-split-list">
          <div className="erp-split-list-head">
            <span>할 일 목록</span>
            <span className="erp-u-muted erp-u-normal">
              총 {formatNumber(rows.length)}건
            </span>
          </div>
          <ListSearchForm
            formId="todos-search-form"
            className="erp-u-p-8"
            q={q}
            placeholder="제목·거래처·품목 검색"
            ariaLabel="할일 검색"
            hideSubmit
            hidden={{ ...(status !== "all" ? { status } : {}), ...(type !== "all" ? { type } : {}), ...(owner !== "all" ? { owner } : {}) }}
            leading={
              <GuardedLink href="/todos/new" className="erp-btn erp-btn-primary erp-u-nowrap">
                + 새 할일
              </GuardedLink>
            }
          />
          <div className="erp-split-list-body">
            {rows.map((row) => {
              const overdue = !row.done && !!row.due_date && row.due_date < todayStr;
              const items = Array.isArray(row.items) ? (row.items as TodoItemInput[]) : [];
              const partner = row.suppliers?.name ?? row.customers?.name ?? null;
              return (
                <div
                  key={row.id}
                  className={`erp-split-list-row erp-u-flex erp-u-items-start erp-u-gap-s2${row.id === selectedId ? " active" : ""}`}
                >
                  <TodoCheckbox id={row.id} done={row.done} label={row.title} />
                  <Link href={rowHref(row.id)} className="erp-todo-row-link">
                    <span className="erp-todo-row-main">
                      <span className={row.done ? "erp-u-muted erp-u-strike" : "erp-u-semibold"}>{row.title}</span>
                      <span className="erp-split-list-row-sub">
                        {[typeLabels[row.todo_type] ?? row.todo_type, partner, summarizeItems(items, productNameById)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {row.done ? (
                      <GridBadge tone="muted">완료</GridBadge>
                    ) : overdue ? (
                      <GridBadge tone="danger">{`${row.due_date!.slice(5).replace("-", "/")} 지남`}</GridBadge>
                    ) : row.due_date === todayStr ? (
                      <GridBadge tone="warn">오늘</GridBadge>
                    ) : row.due_date ? (
                      <GridBadge tone="muted">{row.due_date.slice(5).replace("-", "/")}</GridBadge>
                    ) : null}
                  </Link>
                </div>
              );
            })}
            {!rows.length && (
              <p className="erp-u-p-12 erp-u-text-compact erp-u-muted">
                {q ? "검색 결과가 없습니다." : "등록된 할 일이 없습니다."}
              </p>
            )}
          </div>
          {!keyword && hasMore && (
            <div className="erp-u-bt-border" style={{ padding: "var(--erp-space-3)" }}>
              <Link href={moreHref} className="erp-btn" style={{ width: "100%" }}>
                더보기 (다음 {formatNumber(LIST_LIMIT_STEP)}건)
              </Link>
            </div>
          )}
        </section>

        <div className="erp-split-detail">
          {selectedId ? (
            <TodoDetailPanel key={selectedId} id={selectedId} mode="view" />
          ) : (
            <SplitDetailEmpty icon={<CheckCircleIcon />} title="할 일을 선택해주세요" hint="왼쪽 목록에서 할 일을 누르면 여기에 내용이 표시됩니다. 새 할 일은 [F2 새 할일]로 등록합니다." />
          )}
        </div>
      </div>
    </div>
  );
}
