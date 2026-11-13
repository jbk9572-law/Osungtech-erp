// 메인 대시보드 "위젯 배치" — 사용자가 위젯을 끌어서 옮기고 크기를 조절한 결과를 저장·복원하는
// 순수 로직(서버·브라우저 모두에서 쓴다). 화면(react-grid-layout)이나 DB와 무관하게 여기서
// 위젯 목록·기본 배치·저장값 검증을 한 곳으로 모아, 새 위젯을 추가해도 이 목록만 고치면 된다.
//
// 저장값은 사용자 입력이므로 항상 normalizeDashboardLayout()을 거쳐 쓴다: 모르는 위젯 id 제거,
// 숫자 범위 제한, 빠진 위젯은 기본 위치로 채움(나중에 위젯이 추가돼도 기존 사용자 화면이 안 깨진다).

export const DASHBOARD_COLS = 12;
export const DASHBOARD_ROW_HEIGHT = 24;
export const DASHBOARD_MARGIN = 12;
const MAX_ROWS = 200;

export const DASHBOARD_WIDGETS = [
  { id: "kpi", title: "오늘 한눈에", bare: true, min: { w: 6, h: 2 }, def: { x: 0, y: 0, w: 12, h: 3 } },
  { id: "quick", title: "빠른 실행", min: { w: 2, h: 4 }, def: { x: 0, y: 3, w: 2, h: 5 } },
  { id: "lookup", title: "빠른 재고 조회", min: { w: 2, h: 4 }, def: { x: 0, y: 8, w: 2, h: 4 } },
  { id: "memos", title: "최근 메모", min: { w: 2, h: 4 }, def: { x: 0, y: 12, w: 2, h: 5 } },
  { id: "todo", title: "오늘 할 일", min: { w: 4, h: 6 }, def: { x: 2, y: 3, w: 7, h: 10 } },
  { id: "calendar", title: "달력", min: { w: 4, h: 10 }, def: { x: 2, y: 13, w: 7, h: 15 } },
  { id: "report", title: "오늘 리포트", min: { w: 3, h: 8 }, def: { x: 9, y: 3, w: 3, h: 26 } },
  { id: "overdue", title: "기한 지난 미수금", min: { w: 2, h: 4 }, def: { x: 9, y: 29, w: 3, h: 6 } },
  { id: "stockRisk", title: "재고위험", min: { w: 2, h: 4 }, def: { x: 9, y: 35, w: 3, h: 5 } },
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number]["id"];

export type DashboardLayoutItem = { id: DashboardWidgetId; x: number; y: number; w: number; h: number };
export type DashboardLayout = { items: DashboardLayoutItem[]; hidden: DashboardWidgetId[] };

const WIDGET_BY_ID = new Map<string, (typeof DASHBOARD_WIDGETS)[number]>(DASHBOARD_WIDGETS.map((w) => [w.id, w]));

export function isDashboardWidgetId(v: unknown): v is DashboardWidgetId {
  return typeof v === "string" && WIDGET_BY_ID.has(v);
}

export function defaultDashboardLayout(): DashboardLayout {
  return { items: DASHBOARD_WIDGETS.map((w) => ({ id: w.id, ...w.def })), hidden: [] };
}

function clampInt(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, Math.round(v)));
}

// 저장된 값(어떤 모양이든)을 안전한 배치로 바꾼다 — 잘못된 항목은 버리고 기본 위치로 대체한다.
export function normalizeDashboardLayout(raw: unknown): DashboardLayout {
  const base = defaultDashboardLayout();
  if (!raw || typeof raw !== "object") return base;
  const src = raw as { items?: unknown; hidden?: unknown };

  const hidden: DashboardWidgetId[] = [];
  if (Array.isArray(src.hidden)) {
    for (const h of src.hidden.slice(0, DASHBOARD_WIDGETS.length)) {
      if (isDashboardWidgetId(h) && !hidden.includes(h)) hidden.push(h);
    }
  }

  const seen = new Set<string>();
  const items: DashboardLayoutItem[] = [];
  if (Array.isArray(src.items)) {
    for (const it of src.items.slice(0, DASHBOARD_WIDGETS.length * 2)) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      if (!isDashboardWidgetId(o.id) || seen.has(o.id)) continue;
      const meta = WIDGET_BY_ID.get(o.id)!;
      const w = clampInt(o.w, meta.min.w, DASHBOARD_COLS);
      const h = clampInt(o.h, meta.min.h, MAX_ROWS);
      const x = clampInt(o.x, 0, DASHBOARD_COLS - 1);
      const y = clampInt(o.y, 0, MAX_ROWS);
      if (w === null || h === null || x === null || y === null) continue;
      seen.add(o.id);
      items.push({ id: o.id, x: Math.min(x, DASHBOARD_COLS - w), y, w, h });
    }
  }
  // 저장값에 없는 위젯(새로 추가됐거나 손상된 항목)은 숨긴 게 아니라면 기본 위치로 채운다 —
  // 겹침은 화면(grid)의 세로 압축이 알아서 정리한다.
  for (const d of base.items) {
    if (!seen.has(d.id) && !hidden.includes(d.id)) items.push(d);
  }
  return { items: resolveOverlaps(items.filter((i) => !hidden.includes(i.id))), hidden };
}

// 겹친 위젯은 아래로 밀어낸다 — 화면에서 확정된 배치(grid가 이미 겹침 없이 정리한 값)는 그대로 두고,
// 기본 위치로 채운 위젯이나 손상된 저장값만 정리한다. 위→아래, 왼쪽→오른쪽 순서로 한 개씩 확정한다.
export function resolveOverlaps(input: DashboardLayoutItem[]): DashboardLayoutItem[] {
  const placed: DashboardLayoutItem[] = [];
  for (const it of [...input].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const cur = { ...it };
    for (;;) {
      const hit = placed.find(
        (p) => cur.x < p.x + p.w && p.x < cur.x + cur.w && cur.y < p.y + p.h && p.y < cur.y + cur.h,
      );
      if (!hit) break;
      cur.y = hit.y + hit.h;
    }
    placed.push(cur);
  }
  return input.map((i) => placed.find((p) => p.id === i.id)!);
}

// 좁은 화면(한 줄로 쌓는 경우)에서 쓰는 순서: 위→아래, 같은 줄이면 왼쪽→오른쪽.
export function stackOrder(layout: DashboardLayout): DashboardWidgetId[] {
  return [...layout.items].sort((a, b) => a.y - b.y || a.x - b.x).map((i) => i.id);
}

export function widgetTitle(id: DashboardWidgetId): string {
  return WIDGET_BY_ID.get(id)!.title;
}

// 틀(테두리·배경) 없이 안쪽 카드들이 직접 보이는 위젯 — 맨 위 숫자 줄처럼 타일 여러 개가 따로 놓이는 경우.
export function widgetIsBare(id: DashboardWidgetId): boolean {
  return "bare" in WIDGET_BY_ID.get(id)!;
}

export function widgetMin(id: DashboardWidgetId): { w: number; h: number } {
  return WIDGET_BY_ID.get(id)!.min;
}
