import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { PartyBalance } from "@/lib/ar-ap";
import { getMyApprovalQueue } from "@/lib/dashboard-approvals";
import { getDashboardMail } from "@/lib/dashboard-mail";
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
  options: { id: SourceId; title: string }[];
  overdueCustomers: OverdueCustomer[];
};

export async function resolveDashboardSources(input: {
  supabase: SupabaseClient<Database>;
  userId: string | null;
  todayStr: string;
  backHref: string;
  selection: DashboardSourceSelection;
  customerBalances: PartyBalance[] | null;
  supplierBalances: PartyBalance[] | null;
  todos: TodoNoticeInput[];
  carryovers: CarryoverInput[];
  lowStock: LowStockInput[];
  announcements: AnnouncementInput[];
}): Promise<ResolvedSources> {
  const chosen = new Set<SourceId>([...input.selection.todo, ...input.selection.news, input.selection.listA, input.selection.listB]);
  // 메일은 기능 on/off와 내 계정 연동 여부를 봐야 해서 별도 조회 — 메일 목록 자체는 "받은 메일"을 고른 경우에만 불러온다.
  const mail = await getDashboardMail(input.supabase, input.userId, chosen.has("mail"));
  const can = (id: SourceId) => {
    const need = sourceRequirement(id);
    return need === "receivables" ? !!input.customerBalances : need === "payables" ? !!input.supplierBalances : need === "mail" ? mail.available : true;
  };
  const overdueCustomers = input.customerBalances ? findOverdueCustomers(input.customerBalances, input.todayStr) : [];
  const approvals =
    chosen.has("approval") && input.userId ? await getMyApprovalQueue(input.supabase, input.userId, input.todayStr) : [];
  const all = buildSourceItems({
    approvals,
    overdue: overdueCustomers,
    payables: input.supplierBalances ? findOverdueCustomers(input.supplierBalances, input.todayStr) : [],
    todos: input.todos,
    carryovers: input.carryovers,
    lowStock: input.lowStock,
    announcements: input.announcements,
    mails: chosen.has("mail") ? mail.items : [],
    todayStr: input.todayStr,
    backHref: input.backHref,
  });
  return {
    itemsOf: (id) => (can(id) ? all[id] : null),
    options: DASHBOARD_SOURCES.filter((s) => can(s.id)).map((s) => ({ id: s.id, title: s.title })),
    overdueCustomers,
  };
}
