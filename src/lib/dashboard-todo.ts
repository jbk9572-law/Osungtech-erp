import { RECEIVABLE_OVERDUE_DAYS, type PartyBalance } from "@/lib/ar-ap";

// 메인 화면 "오늘 할 일" — 결재 대기·연체 미수금·내 할 일·이월 건을 한 목록으로 묶는 순수 로직.
// 데이터를 가져오는 쪽(page.tsx, dashboard-approvals.ts)과 그리는 쪽(dashboard-todo-panel.tsx)을
// 분리해서, 합치는 규칙(순서·문구·링크)만 여기서 테스트한다.

export type OverdueCustomer = { id: string; name: string; balance: number; daysOverdue: number };
export type ApprovalQueueItem = { id: string; title: string; createdAt: string; authorName: string | null };
export type TodoNoticeInput = { id: string; title: string; due_date: string | null };
export type CarryoverInput = { fromDate: string; itemCount: number; kind: "sales" | "purchase" };

export type TodoKind = "approval" | "overdue" | "todo" | "carryover";
export type TodoItem = {
  key: string;
  kind: TodoKind;
  title: string;
  sub: string;
  due: string;
  href: string;
  action: string;
};

export const TODO_KIND_LABEL: Record<TodoKind, string> = {
  approval: "결재 대기",
  overdue: "연체 미수금",
  todo: "내 할 일",
  carryover: "이월",
};

const MS_PER_DAY = 86_400_000;

// "2026-11-05" → "2026-11-12"까지 지난 일수(날짜 문자열끼리 계산해 타임존 영향을 받지 않는다).
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / MS_PER_DAY);
}

// 연체 기준은 메신저 연체 알림과 같다(RECEIVABLE_OVERDUE_DAYS) — 화면과 알림이 서로 다른 거래처를 말하지 않게.
export function findOverdueCustomers(
  balances: PartyBalance[],
  todayStr: string,
  minDays: number = RECEIVABLE_OVERDUE_DAYS,
): OverdueCustomer[] {
  const out: OverdueCustomer[] = [];
  for (const b of balances) {
    if (b.balance <= 0 || !b.oldestUnpaidDate) continue;
    const daysOverdue = daysBetween(b.oldestUnpaidDate, todayStr);
    if (daysOverdue >= minDays) out.push({ id: b.id, name: b.name, balance: b.balance, daysOverdue });
  }
  return out.sort((x, y) => y.daysOverdue - x.daysOverdue || y.balance - x.balance);
}

function formatMonthDay(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export function buildTodoItems(input: {
  approvals: ApprovalQueueItem[];
  overdue: OverdueCustomer[];
  todos: TodoNoticeInput[];
  carryovers: CarryoverInput[];
  todayStr: string;
  backHref: string;
}): TodoItem[] {
  const items: TodoItem[] = [];
  for (const a of input.approvals) {
    items.push({
      key: `approval-${a.id}`,
      kind: "approval",
      title: a.title,
      sub: a.authorName ? `${a.authorName} 기안` : "결재 요청",
      due: "내 차례",
      href: `/approvals?id=${a.id}`,
      action: "결재하기 →",
    });
  }
  for (const c of input.overdue) {
    items.push({
      key: `overdue-${c.id}`,
      kind: "overdue",
      title: `${c.name} 미수금 ${won(c.balance)}`,
      sub: `가장 오래된 미결제 ${c.daysOverdue}일 지남`,
      due: `${c.daysOverdue}일 지남`,
      href: "/receivables",
      action: "수금 확인 →",
    });
  }
  for (const t of input.todos) {
    const late = !!t.due_date && t.due_date < input.todayStr;
    items.push({
      key: `todo-${t.id}`,
      kind: "todo",
      title: t.title,
      sub: t.due_date ? `마감 ${formatMonthDay(t.due_date)}${late ? " · 지연" : ""}` : "마감일 없음",
      due: t.due_date ? (late ? "지연" : t.due_date === input.todayStr ? "오늘" : formatMonthDay(t.due_date)) : "",
      href: `/todos/${t.id}?back=${input.backHref}`,
      action: "열기 →",
    });
  }
  for (const [i, c] of input.carryovers.entries()) {
    items.push({
      key: `carryover-${i}-${c.kind}-${c.fromDate}`,
      kind: "carryover",
      title: `${formatMonthDay(c.fromDate)} 작업분 ${c.kind === "sales" ? "매출" : "매입"} 품목 ${c.itemCount}건`,
      sub: "다른 날에서 넘어온 건",
      due: formatMonthDay(c.fromDate),
      href: `/${c.kind === "sales" ? "sales" : "purchases"}?from=${c.fromDate}&to=${c.fromDate}`,
      action: "확인 →",
    });
  }
  return items;
}
