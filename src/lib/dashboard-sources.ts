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
  { id: "sentMail", title: "보낸 메일", tone: "muted", viewAll: "/mail?folder=SENT", requires: "mail", empty: "보낸 메일이 없습니다." },
  { id: "messenger", title: "메신저", tone: "info", viewAll: "/messenger", requires: "messenger", empty: "안 읽은 대화가 없습니다." },
  { id: "board", title: "최근 공지", tone: "muted", viewAll: "/announcements", empty: "공지가 없습니다." },
  { id: "memo", title: "최근 메모", tone: "muted", viewAll: "/calendar", empty: "등록된 메모가 없습니다." },
  { id: "mail", title: "받은 메일", tone: "info", viewAll: "/mail?folder=INBOX", requires: "mail", empty: "읽지 않은 메일이 없습니다." },
] as const;

export type SourceId = (typeof DASHBOARD_SOURCES)[number]["id"];
export type SourceRequirement = "receivables" | "payables" | "mail" | "messenger";

export type DashboardSourceSelection = {
  // "업무" 위젯의 탭(순서대로) — 내가 처리할 것
  todo: SourceId[];
  // "소식" 위젯의 탭(순서대로) — 들어오는 것(메일·공지·메모)
  news: SourceId[];
  // 사용자가 "위젯 추가"로 만드는 추가 칸 2개의 탭 — 처음엔 비어 있다.
  extra1: SourceId[];
  extra2: SourceId[];
};

export const DEFAULT_SOURCE_SELECTION: DashboardSourceSelection = {
  todo: ["todo", "approval", "carryover", "overdue", "lowStock"],
  news: ["mail", "announcement", "memo"],
  extra1: [],
  extra2: [],
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

// 탭 목록(순서 있음) 검증 — 모르는 id·중복은 버리고 최대 개수까지만. 배열이 아니면 기본값.
function normalizeTabList(raw: unknown, fallback: SourceId[]): SourceId[] {
  if (!Array.isArray(raw)) return [...fallback];
  const out: SourceId[] = [];
  for (const t of raw.slice(0, 30)) {
    if (isSourceId(t) && !out.includes(t)) out.push(t);
    if (out.length >= MAX_TODO_TABS) break;
  }
  return out;
}

// 저장값(어떤 모양이든)을 안전한 선택값으로 — 모르는 id·중복은 버리고 빠진 건 기본값.
// 예전에 저장된 목록 칸(listA/listB) 같은 모르는 키는 그냥 무시한다.
export function normalizeSourceSelection(raw: unknown): DashboardSourceSelection {
  const base = DEFAULT_SOURCE_SELECTION;
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    todo: normalizeTabList(src.todo, base.todo),
    news: normalizeTabList(src.news, base.news),
    extra1: normalizeTabList(src.extra1, base.extra1),
    extra2: normalizeTabList(src.extra2, base.extra2),
  };
}
