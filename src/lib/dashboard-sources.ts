// 메인 화면 "내용 고르기" — 위젯 칸(오늘 할 일 탭, 목록 칸)에 사용자가 고르는 내용(원천)의 목록과
// 선택값 검증. 새 내용을 추가할 때는 이 목록에 한 줄 더하고, 데이터 조립(dashboard-todo.ts)에서 항목을
// 만들어 주면 된다 — 화면(칸의 모양)은 어떤 내용이든 같은 줄 모양을 쓴다.

export type SourceTone = "ok" | "warn" | "danger" | "info" | "muted";

export const DASHBOARD_SOURCES = [
  { id: "approval", title: "결재 대기", tone: "warn", viewAll: "/approvals", empty: "내 차례인 결재가 없습니다." },
  { id: "overdue", title: "연체 미수금", tone: "danger", viewAll: "/receivables", requires: "receivables", empty: "기한이 지난 미수금이 없습니다." },
  { id: "payable", title: "연체 미지급금", tone: "danger", viewAll: "/payables", requires: "payables", empty: "기한이 지난 미지급금이 없습니다." },
  { id: "todo", title: "내 할 일", tone: "info", viewAll: "/todos", empty: "마감이 가까운 할 일이 없습니다." },
  { id: "carryover", title: "이월", tone: "muted", viewAll: "/sales", empty: "이월된 건이 없습니다." },
  { id: "lowStock", title: "재고 부족", tone: "warn", viewAll: "/inventory/reorder-suggestions", empty: "안전재고 이하 품목이 없습니다." },
  { id: "announcement", title: "읽지 않은 공지", tone: "info", viewAll: "/announcements", empty: "읽지 않은 공지가 없습니다." },
] as const;

export type SourceId = (typeof DASHBOARD_SOURCES)[number]["id"];
export type SourceRequirement = "receivables" | "payables";

export type DashboardSourceSelection = {
  // "오늘 할 일" 위젯의 탭(순서대로)
  todo: SourceId[];
  // 목록 칸 두 개가 각각 보여줄 내용
  listA: SourceId;
  listB: SourceId;
};

export const DEFAULT_SOURCE_SELECTION: DashboardSourceSelection = {
  todo: ["approval", "overdue", "todo", "carryover"],
  listA: "lowStock",
  listB: "overdue",
};

const META = new Map<string, (typeof DASHBOARD_SOURCES)[number]>(DASHBOARD_SOURCES.map((s) => [s.id, s]));
export const MAX_TODO_TABS = 8;

export function isSourceId(v: unknown): v is SourceId {
  return typeof v === "string" && META.has(v);
}

export function sourceMeta(id: SourceId) {
  return META.get(id)!;
}

export function sourceRequirement(id: SourceId): SourceRequirement | null {
  const m = META.get(id)! as { requires?: SourceRequirement };
  return m.requires ?? null;
}

// 저장값(어떤 모양이든)을 안전한 선택값으로 — 모르는 id·중복은 버리고 빠진 건 기본값.
export function normalizeSourceSelection(raw: unknown): DashboardSourceSelection {
  const base = DEFAULT_SOURCE_SELECTION;
  if (!raw || typeof raw !== "object") return { ...base, todo: [...base.todo] };
  const src = raw as { todo?: unknown; listA?: unknown; listB?: unknown };
  let todo: SourceId[] = [];
  if (Array.isArray(src.todo)) {
    for (const t of src.todo.slice(0, 30)) {
      if (isSourceId(t) && !todo.includes(t)) todo.push(t);
      if (todo.length >= MAX_TODO_TABS) break;
    }
  } else {
    todo = [...base.todo];
  }
  return {
    todo,
    listA: isSourceId(src.listA) ? src.listA : base.listA,
    listB: isSourceId(src.listB) ? src.listB : base.listB,
  };
}
