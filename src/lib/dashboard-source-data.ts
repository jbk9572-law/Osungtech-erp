import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { PartyBalance } from "@/lib/ar-ap";
import { getMyApprovalQueue } from "@/lib/dashboard-approvals";
import { getDashboardMail } from "@/lib/dashboard-mail";
import { getDashboardMessenger } from "@/lib/dashboard-messenger";
import { getRecentBoard } from "@/lib/dashboard-board";
import {
  DASHBOARD_SOURCES,
  sourceRequirement,
  type DashboardSourceSelection,
  type SourceId,
} from "@/lib/dashboard-sources";
import {
  buildSourceItems,
  findOverdueCustomers,
  type AnnouncementInput,
  type CarryoverInput,
  type MemoInput,
  type LowStockInput,
  type OverdueCustomer,
  type TodoItem,
  type TodoNoticeInput,
} from "@/lib/dashboard-todo";

// 사용자가 고른 내용(원천)의 항목을 모아 주는 서버 쪽 조립 — 이미 메인 화면이 불러온 데이터(미수금 잔액,
// 재고위험, 공지, 할 일)를 재사용하고, 결재 대기처럼 따로 조회가 필요한 것은 "고른 경우에만" 불러온다.
// 권한이 필요한 내용(미수금/미지급금)은 해당 잔액을 볼 수 없는 사람에게는 선택 목록에서도 빠진다.
export type ResolvedSources = {
  itemsOf: (id: SourceId) => TodoItem[] | null;
  // 탭 아래에 붙는 한 줄 안내(예: 메일 마지막 확인 시각) — 없으면 null
  noteOf: (id: SourceId) => string | null;
  options: { id: SourceId; title: string }[];
  overdueCustomers: OverdueCustomer[];
};

// 고른 내용에 필요한 "밖에서 가져오는" 자료(메일·메신저·공지·결재 대기)를 한꺼번에 불러온다. 이 자료는 메인 화면의 다른
// 조회 결과(미수금·할 일 등)와 상관없으므로, 화면 맨 처음에 시작해 두고 마지막에 resolveDashboardSources에 넘기면 다른
// 조회와 동시에 진행된다(예전엔 맨 마지막에 순서대로 시작해서 그만큼 더 기다렸다).
export type SourcePrefetch = {
  chosen: Set<SourceId>;
  mail: Awaited<ReturnType<typeof getDashboardMail>>;
  messenger: Awaited<ReturnType<typeof getDashboardMessenger>>;
  boards: Awaited<ReturnType<typeof getRecentBoard>>;
  approvals: Awaited<ReturnType<typeof getMyApprovalQueue>>;
};

export async function prefetchDashboardSources(input: {
  supabase: SupabaseClient<Database>;
  userId: string | null;
  todayStr: string;
  selection: DashboardSourceSelection;
}): Promise<SourcePrefetch> {
  const chosen = new Set<SourceId>([...input.selection.todo, ...input.selection.news, ...input.selection.extra1, ...input.selection.extra2]);
  // 메일은 기능 on/off와 내 계정 연동 여부를 봐야 해서 별도 조회 — 메일 목록 자체는 "받은 메일"을 고른 경우에만 불러온다.
  const [mail, messenger, boards, approvals] = await Promise.all([
    getDashboardMail(input.supabase, input.userId, { inbox: chosen.has("mail"), sent: chosen.has("sentMail") }),
    getDashboardMessenger(input.supabase, input.userId, chosen.has("messenger")),
    chosen.has("board") ? getRecentBoard(input.supabase) : Promise.resolve([]),
    chosen.has("approval") && input.userId ? getMyApprovalQueue(input.supabase, input.userId, input.todayStr) : Promise.resolve([]),
  ]);
  return { chosen, mail, messenger, boards, approvals };
}

export async function resolveDashboardSources(input: {
  prefetch: Promise<SourcePrefetch>;
  todayStr: string;
  backHref: string;
  customerBalances: PartyBalance[] | null;
  supplierBalances: PartyBalance[] | null;
  todos: TodoNoticeInput[];
  carryovers: CarryoverInput[];
  lowStock: LowStockInput[];
  announcements: AnnouncementInput[];
  memos: MemoInput[];
}): Promise<ResolvedSources> {
  const { chosen, mail, messenger, boards, approvals } = await input.prefetch;
  const can = (id: SourceId) => {
    const need = sourceRequirement(id);
    return need === "receivables" ? !!input.customerBalances : need === "payables" ? !!input.supplierBalances : need === "mail" ? mail.available : need === "messenger" ? messenger.available : true;
  };
  const overdueCustomers = input.customerBalances ? findOverdueCustomers(input.customerBalances, input.todayStr) : [];
  const all = buildSourceItems({
    approvals,
    overdue: overdueCustomers,
    payables: input.supplierBalances ? findOverdueCustomers(input.supplierBalances, input.todayStr) : [],
    todos: input.todos,
    carryovers: input.carryovers,
    lowStock: input.lowStock,
    announcements: input.announcements,
    mails: chosen.has("mail") ? mail.items : [],
    sentMails: mail.sentItems,
    chats: messenger.items,
    boards,
    memos: input.memos,
    todayStr: input.todayStr,
    backHref: input.backHref,
  });
  return {
    itemsOf: (id) => (can(id) ? all[id] : null),
    noteOf: (id) => (id === "mail" || id === "sentMail" ? mail.syncNote : null),
    options: DASHBOARD_SOURCES.filter((s) => can(s.id)).map((s) => ({ id: s.id, title: s.title })),
    overdueCustomers,
  };
}
