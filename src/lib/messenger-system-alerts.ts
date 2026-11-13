import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { toKstDateStr } from "@/lib/kst-date";
import { computePartyBalance, RECEIVABLE_OVERDUE_DAYS } from "@/lib/ar-ap";
import { formatNumber } from "@/lib/format-number";

export type AlertSyncResult = { posted: number; cleared: number };

type AlertType = "low_stock" | "todo_due" | "receivable_overdue";

type TenantKey = string; // `${tenant_id}:${is_demo}`
function tenantKey(tenantId: string, isDemo: boolean): TenantKey {
  return `${tenantId}:${isDemo}`;
}

// 안전재고부족/할일 마감임박·지연을, 지금까지 쓰던 타이틀바 종+토스트
// 팝업 대신(코드 쪽에서 그 둘은 뺐다 — notification-bell.tsx/-toaster.tsx)
// 그룹웨어 메신저 "전체" 채널에 시스템봇(sender_id = null)으로 올린다.
// 거래처 포털 발주 알림(src/app/portal/(app)/new/actions.ts)과 완전히
// 같은 패턴 — 세션이 없는 크론이라 get_or_create_all_channel() RPC(호출자
// 세션의 current_tenant_id() 필요) 대신 테넌트별로 직접 조회/생성한다.
//
// 매번 돌 때마다 같은 알림을 또 올리면 스팸이 되므로, 이미 올린 건
// messenger_system_alert_state에 남겨 건너뛰고, 조건이 풀리면(재입고,
// 할일 완료/마감일 변경) 그 행을 지워 다음에 다시 알릴 수 있게 한다.
export async function syncMessengerSystemAlerts(): Promise<AlertSyncResult> {
  const admin = createAdminClient();

  const soonDate = new Date();
  soonDate.setDate(soonDate.getDate() + 3);
  const soonStr = toKstDateStr(soonDate);

  const [products, dueTodos, existingAlerts] = await Promise.all([
    fetchAllRows<{
      id: string;
      name: string;
      reorder_point: number;
      tenant_id: string;
      is_demo: boolean;
      inventory: { quantity: number }[];
    }>((from, to) =>
      admin
        .from("products")
        .select("id, name, reorder_point, tenant_id, is_demo, inventory(quantity)")
        .gt("reorder_point", 0)
        .range(from, to),
    ),
    fetchAllRows<{
      id: string;
      title: string;
      due_date: string | null;
      tenant_id: string;
      is_demo: boolean;
    }>((from, to) =>
      admin
        .from("todos")
        .select("id, title, due_date, tenant_id, is_demo")
        .eq("done", false)
        .lte("due_date", soonStr)
        .range(from, to),
    ),
    fetchAllRows<{ tenant_id: string; is_demo: boolean; alert_type: AlertType; source_id: string }>(
      (from, to) => admin.from("messenger_system_alert_state").select("tenant_id, is_demo, alert_type, source_id").range(from, to),
    ),
  ]);

  const overdueCustomers = await findOverdueCustomers(admin);

  const lowStockProducts = products.filter(
    (p) => (p.inventory ?? []).reduce((sum, inv) => sum + Number(inv.quantity), 0) <= p.reorder_point,
  );

  const currentLowStockIds = new Set(lowStockProducts.map((p) => p.id));
  const currentDueTodoIds = new Set(dueTodos.map((t) => t.id));
  const currentOverdueCustomerIds = new Set(overdueCustomers.map((c) => c.id));

  const alreadyAlerted = new Set(
    existingAlerts.map((a) => `${tenantKey(a.tenant_id, a.is_demo)}:${a.alert_type}:${a.source_id}`),
  );

  type PendingMessage = { tenantId: string; isDemo: boolean; content: string };
  const toPost: PendingMessage[] = [];
  const toInsertState: { tenant_id: string; is_demo: boolean; alert_type: AlertType; source_id: string }[] = [];
  const toDeleteState: { tenant_id: string; is_demo: boolean; alert_type: AlertType; source_id: string }[] = [];

  for (const p of lowStockProducts) {
    const key = `${tenantKey(p.tenant_id, p.is_demo)}:low_stock:${p.id}`;
    if (alreadyAlerted.has(key)) continue;
    const quantity = (p.inventory ?? []).reduce((sum, inv) => sum + Number(inv.quantity), 0);
    toPost.push({
      tenantId: p.tenant_id,
      isDemo: p.is_demo,
      content: `⚠️ [안전재고부족] ${p.name} · 현재 ${quantity} / 기준 ${p.reorder_point} — 재고현황에서 확인해주세요.`,
    });
    toInsertState.push({ tenant_id: p.tenant_id, is_demo: p.is_demo, alert_type: "low_stock", source_id: p.id });
  }

  const today = toKstDateStr(new Date());
  for (const t of dueTodos) {
    const key = `${tenantKey(t.tenant_id, t.is_demo)}:todo_due:${t.id}`;
    if (alreadyAlerted.has(key)) continue;
    const overdue = !!t.due_date && t.due_date < today;
    toPost.push({
      tenantId: t.tenant_id,
      isDemo: t.is_demo,
      content: `📋 [할일 ${overdue ? "지연" : "마감임박"}] ${t.title}${t.due_date ? ` · 마감 ${t.due_date}` : ""} — 할일 목록에서 확인해주세요.`,
    });
    toInsertState.push({ tenant_id: t.tenant_id, is_demo: t.is_demo, alert_type: "todo_due", source_id: t.id });
  }

  for (const c of overdueCustomers) {
    const key = `${tenantKey(c.tenant_id, c.is_demo)}:receivable_overdue:${c.id}`;
    if (alreadyAlerted.has(key)) continue;
    toPost.push({
      tenantId: c.tenant_id,
      isDemo: c.is_demo,
      content: `💰 [미수금 연체] ${c.name} · ${c.daysOverdue}일 연체 · 미수금 ${formatNumber(c.balance)}원 — 미수금현황에서 확인해주세요.`,
    });
    toInsertState.push({ tenant_id: c.tenant_id, is_demo: c.is_demo, alert_type: "receivable_overdue", source_id: c.id });
  }

  // 조건이 풀린 건(재입고됐거나, 할일이 완료/마감일 연장됐거나 삭제된 것,
  // 미수금이 다 갚이거나 연체 기준 밑으로 내려간 것)은 추적 행을 지워
  // 다음에 다시 조건이 생기면 다시 알릴 수 있게 한다.
  for (const a of existingAlerts) {
    const stillPending =
      a.alert_type === "low_stock"
        ? currentLowStockIds.has(a.source_id)
        : a.alert_type === "todo_due"
          ? currentDueTodoIds.has(a.source_id)
          : currentOverdueCustomerIds.has(a.source_id);
    if (!stillPending) {
      toDeleteState.push(a);
    }
  }

  // 테넌트별로 "전체" 채널을 찾거나 만들고, 모아둔 메시지를 한 번에 올린다.
  const channelCache = new Map<TenantKey, string | null>();
  async function resolveAllChannel(tenantId: string, isDemo: boolean): Promise<string | null> {
    const key = tenantKey(tenantId, isDemo);
    if (channelCache.has(key)) return channelCache.get(key) ?? null;

    const { data: existingChannel } = await admin
      .from("messenger_channels")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_demo", isDemo)
      .eq("type", "all")
      .maybeSingle();
    let channelId = existingChannel?.id ?? null;
    if (!channelId) {
      const { data: created, error } = await admin
        .from("messenger_channels")
        .insert({ tenant_id: tenantId, is_demo: isDemo, type: "all" })
        .select("id")
        .single();
      if (error) console.error("전체 채널 생성 실패:", error.message);
      channelId = created?.id ?? null;
    }
    channelCache.set(key, channelId);
    return channelId;
  }

  let posted = 0;
  for (const msg of toPost) {
    const channelId = await resolveAllChannel(msg.tenantId, msg.isDemo);
    if (!channelId) continue;
    const { error } = await admin
      .from("messenger_messages")
      .insert({ channel_id: channelId, sender_id: null, content: msg.content });
    if (error) {
      console.error("시스템 알림 메시지 전송 실패:", error.message);
      continue;
    }
    posted += 1;
  }

  if (toInsertState.length) {
    const { error } = await admin.from("messenger_system_alert_state").insert(toInsertState);
    if (error) console.error("알림 상태 기록 실패:", error.message);
  }

  let cleared = 0;
  for (const a of toDeleteState) {
    const { error, count } = await admin
      .from("messenger_system_alert_state")
      .delete({ count: "exact" })
      .eq("tenant_id", a.tenant_id)
      .eq("is_demo", a.is_demo)
      .eq("alert_type", a.alert_type)
      .eq("source_id", a.source_id);
    if (error) {
      console.error("알림 상태 정리 실패:", error.message);
      continue;
    }
    cleared += count ?? 0;
  }

  return { posted, cleared };
}

type OverdueCustomer = { id: string; name: string; tenant_id: string; is_demo: boolean; balance: number; daysOverdue: number };

// get_customer_balances() RPC(lib/ar-ap.ts의 getAllCustomerBalances가 씀)는
// current_tenant_id()/is_demo_actor()로 "호출한 세션의 테넌트"만 본다 —
// 세션 없는 크론(admin 클라이언트)에서는 그 값이 없어 쓸 수 없다. 그래서
// 이 함수는 모든 테넌트의 원본 테이블을 직접 훑어서(이미 위 low_stock/
// todo_due와 같은 패턴), 고객 상세 화면이 이미 쓰는 순수 계산 함수
// (computePartyBalance/consumeOldestFirst, lib/ar-ap.ts)를 그대로
// 재사용한다 — "가장 오래된 미결제 전표부터 선입선출로 상계"라는 같은
// 규칙을 여기서 또 다르게 구현하지 않기 위해서다.
export async function findOverdueCustomers(admin: ReturnType<typeof createAdminClient>): Promise<OverdueCustomer[]> {
  const [orders, payments, customers] = await Promise.all([
    fetchAllRows<{
      customer_id: string;
      order_date: string;
      is_return: boolean;
      sales_order_items: { quantity: number; unit_price: string | number }[];
    }>((from, to) =>
      admin
        .from("sales_orders")
        .select("customer_id, order_date, is_return, sales_order_items(quantity, unit_price)")
        .is("payment_method", null)
        .range(from, to),
    ),
    fetchAllRows<{ customer_id: string; paid_at: string; amount: string | number }>((from, to) =>
      admin.from("customer_payments").select("customer_id, paid_at, amount").range(from, to),
    ),
    fetchAllRows<{ id: string; name: string; tenant_id: string; is_demo: boolean }>((from, to) =>
      admin.from("customers").select("id, name, tenant_id, is_demo").range(from, to),
    ),
  ]);

  const ordersByCustomer = new Map<string, { total: number; date: string }[]>();
  for (const o of orders) {
    const total =
      (o.sales_order_items ?? []).reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0) *
      (o.is_return ? -1 : 1);
    const list = ordersByCustomer.get(o.customer_id) ?? [];
    list.push({ total, date: o.order_date });
    ordersByCustomer.set(o.customer_id, list);
  }
  for (const list of ordersByCustomer.values()) list.sort((a, b) => a.date.localeCompare(b.date));

  const paymentsByCustomer = new Map<string, { id: string; paid_at: string; amount: string | number; method: null; memo: null }[]>();
  for (const p of payments) {
    const list = paymentsByCustomer.get(p.customer_id) ?? [];
    list.push({ id: "", paid_at: p.paid_at, amount: p.amount, method: null, memo: null });
    paymentsByCustomer.set(p.customer_id, list);
  }

  const overdue: OverdueCustomer[] = [];
  for (const c of customers) {
    const creditOrders = ordersByCustomer.get(c.id);
    if (!creditOrders?.length) continue;
    const { balance, unpaidOrders } = computePartyBalance(creditOrders, paymentsByCustomer.get(c.id) ?? []);
    if (balance <= 0 || !unpaidOrders.length) continue;
    const daysOverdue = unpaidOrders[0].daysOverdue;
    if (daysOverdue >= RECEIVABLE_OVERDUE_DAYS) {
      overdue.push({ id: c.id, name: c.name, tenant_id: c.tenant_id, is_demo: c.is_demo, balance, daysOverdue });
    }
  }
  return overdue;
}
