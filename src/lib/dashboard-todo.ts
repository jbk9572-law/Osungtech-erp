import { RECEIVABLE_OVERDUE_DAYS, type PartyBalance } from "@/lib/ar-ap";
import type { SourceId } from "@/lib/dashboard-sources";

// 메인 화면 "오늘 할 일" — 결재 대기·연체 미수금·내 할 일·이월 건을 한 목록으로 묶는 순수 로직.
// 데이터를 가져오는 쪽(page.tsx, dashboard-approvals.ts)과 그리는 쪽(dashboard-todo-panel.tsx)을
// 분리해서, 합치는 규칙(순서·문구·링크)만 여기서 테스트한다.

export type OverdueCustomer = { id: string; name: string; balance: number; daysOverdue: number };
export type ApprovalQueueItem = { id: string; title: string; createdAt: string; authorName: string | null };
export type TodoNoticeInput = { id: string; title: string; due_date: string | null };
export type CarryoverInput = { fromDate: string; itemCount: number; kind: "sales" | "purchase" };

export type LowStockInput = { id: string; name: string; quantity: number; reorderPoint: number };
export type AnnouncementInput = { id: string; title: string; pinned: boolean };
export type MemoInput = { id: string; noteDate: string; content: string; author: string };
export type MailInput = { id: string; subject: string; fromName: string; sentLabel: string };

export type TodoItem = {
  key: string;
  kind: SourceId;
  title: string;
  sub: string;
  due: string;
  href: string;
  action: string;
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

// 내용(원천)별 항목 목록을 한 번에 만든다. 화면은 고른 내용만 꺼내 쓴다.
export function buildSourceItems(input: {
  approvals: ApprovalQueueItem[];
  overdue: OverdueCustomer[];
  payables: OverdueCustomer[];
  todos: TodoNoticeInput[];
  carryovers: CarryoverInput[];
  lowStock: LowStockInput[];
  announcements: AnnouncementInput[];
  mails: MailInput[];
  memos: MemoInput[];
  todayStr: string;
  backHref: string;
}): Record<SourceId, TodoItem[]> {
  const out: Record<SourceId, TodoItem[]> = { approval: [], overdue: [], payable: [], todo: [], carryover: [], lowStock: [], announcement: [], mail: [], memo: [] };
  for (const a of input.approvals) {
    out.approval.push({
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
    out.overdue.push({
      key: `overdue-${c.id}`,
      kind: "overdue",
      title: `${c.name} 미수금 ${won(c.balance)}`,
      sub: `가장 오래된 미결제 ${c.daysOverdue}일 지남`,
      due: `${c.daysOverdue}일 지남`,
      href: "/receivables",
      action: "수금 확인 →",
    });
  }
  for (const c of input.payables) {
    out.payable.push({
      key: `payable-${c.id}`,
      kind: "payable",
      title: `${c.name} 미지급금 ${won(c.balance)}`,
      sub: `가장 오래된 미지급 ${c.daysOverdue}일 지남`,
      due: `${c.daysOverdue}일 지남`,
      href: "/payables",
      action: "지급 확인 →",
    });
  }
  for (const t of input.todos) {
    const late = !!t.due_date && t.due_date < input.todayStr;
    out.todo.push({
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
    out.carryover.push({
      key: `carryover-${i}-${c.kind}-${c.fromDate}`,
      kind: "carryover",
      title: `${formatMonthDay(c.fromDate)} 작업분 ${c.kind === "sales" ? "매출" : "매입"} 품목 ${c.itemCount}건`,
      sub: "다른 날에서 넘어온 건",
      due: formatMonthDay(c.fromDate),
      href: `/${c.kind === "sales" ? "sales" : "purchases"}?from=${c.fromDate}&to=${c.fromDate}`,
      action: "확인 →",
    });
  }
  for (const p of input.lowStock) {
    out.lowStock.push({
      key: `lowStock-${p.id}`,
      kind: "lowStock",
      title: p.name,
      sub: `현재 ${p.quantity.toLocaleString("ko-KR")} / 기준 ${p.reorderPoint.toLocaleString("ko-KR")}`,
      due: "",
      href: `/inventory/item/${p.id}`,
      action: "보기 →",
    });
  }
  for (const a of input.announcements) {
    out.announcement.push({
      key: `announcement-${a.id}`,
      kind: "announcement",
      title: `${a.pinned ? "📌 " : ""}${a.title}`,
      sub: "아직 읽지 않은 공지",
      due: "",
      href: `/announcements/${a.id}?back=${input.backHref}`,
      action: "읽기 →",
    });
  }
  for (const m of input.mails) {
    out.mail.push({
      key: `mail-${m.id}`,
      kind: "mail",
      title: m.subject,
      sub: m.fromName,
      due: m.sentLabel,
      href: `/mail?folder=INBOX&id=${m.id}`,
      action: "읽기 →",
    });
  }
  for (const n of input.memos) {
    out.memo.push({
      key: `memo-${n.id}`,
      kind: "memo",
      title: n.content,
      sub: n.author,
      due: formatMonthDay(n.noteDate),
      href: `/dashboard?month=${n.noteDate.slice(0, 7)}`,
      action: "",
    });
  }
  return out;
}
