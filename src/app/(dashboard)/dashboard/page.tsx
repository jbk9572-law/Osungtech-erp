import { withPageTiming } from "@/lib/page-timing";
import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { QuickStockLookup, type StockLookupProduct } from "@/components/quick-stock-lookup";
import { sumInventoryQuantity } from "@/lib/inventory-quantity";
import { getNotificationSummary } from "@/lib/notifications";
import { buildBackHref } from "@/lib/list-return";
import { getCurrentActor } from "@/lib/current-actor";
import { todoTypeLabel } from "@/lib/todo-flow";
import { mergePaperCalcInputItems, type PaperCalcSizeRow } from "@/modules/paper-calc/public";
import { PAPER_STOCK_SKU, isPaperCalcEnabled } from "@/modules/paper-calc/public";
import { nowInKst, toKstDateStr } from "@/lib/kst-date";
import { getCalendarItems, type CalendarItem } from "@/lib/calendar-data";
import { GridBadge } from "@/components/grid/badge";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { canViewPage } from "@/lib/department-page-access";
import { normalizeDashboardLayout } from "@/lib/dashboard-layout";
import { QuickActionsPanel, RecentMemosPanel } from "@/components/dashboard-side-panels";
import { DashboardSourcePanel } from "@/components/dashboard-source-panel";
import { sourceMeta, type SourceId } from "@/lib/dashboard-sources";
import { DashboardKpiStrip } from "@/components/dashboard-kpi-strip";
import { DashboardTodoPanel } from "@/components/dashboard-todo-panel";
import { resolveDashboardSources } from "@/lib/dashboard-source-data";
import { getAllCustomerBalances, getAllSupplierBalances, sumOutstandingBalance } from "@/lib/ar-ap";
import type { ReportMoney } from "@/components/daily-report-box";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// created_at(timestamptz)으로 "이번 달에 실제 작업했는지"를 걸러낼 때 쓴다 —
// order_date(시간 없는 날짜)와 달리 시각까지 있는 컬럼이라, KST 자정 경계를
// UTC 기준으로 환산해서 넘겨야 gte/lt 필터가 정확히 그 달 하루하루와 맞는다.
function kstMonthRangeUtcIso(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1) - 9 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(year, month, 1) - 9 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function buildWeeks(year: number, month: number) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: ({ dateStr: string; day: number } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ dateStr: toDateStr(year, month, day), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  // 서버는 보통 UTC로 도는데, "오늘"을 그냥 new Date()로 구하면 한국
  // 자정~오전 9시 사이엔 서버가 아직 어제라고 착각한다 — 한국 기준으로
  // 고정해서 구한다(자세한 이유는 kst-date.ts 참고).
  const now = nowInKst();
  const [year, month] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];

  const monthStart = toDateStr(year, month, 1);
  const monthEnd = toDateStr(year, month, new Date(year, month, 0).getDate());

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const prevMonthHref = `/dashboard?month=${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`;
  const nextMonthHref = `/dashboard?month=${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}`;

  const supabase = await createClient();
  const todayStr = toDateStr(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  // 지금 보는 달에 이월(is_carryover)로 들어온 전월 실적을 이번 달 매출/매입
  // 합계에 더해야 해서, 전월 구간도 따로 조회한다 — 그 건들은 실제 처리일
  // (order_date)이 전월이라 달력에는 전월 쪽에 표시되고, 금액만 이번 달
  // 합계로 잡힌다.
  const prevMonthStart = toDateStr(prevDate.getFullYear(), prevDate.getMonth() + 1, 1);
  const prevMonthEnd = toDateStr(
    prevDate.getFullYear(),
    prevDate.getMonth() + 1,
    new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate()
  );
  // 이월(is_carryover) 건은 전표날짜(order_date)를 다른 달/날짜로 찍어도,
  // 실제 작업일(created_at) 기준으로는 이번 달 "오늘의 업무"에 그대로
  // 남아있어야 한다 — 아래 carryoverWorkSales/Purchases 조회에서 쓴다.
  const workDateRange = kstMonthRangeUtcIso(year, month);

  const [user, { userId: currentUserId, isAdmin }, paperCalcEnabled] = await Promise.all([
    getUser(),
    getCurrentActor(supabase),
    isPaperCalcEnabled(supabase),
  ]);

  // 사용자가 저장한 위젯 배치(없으면 기본 배치) — 저장값은 항상 검증·보정해서 쓴다.
  const { data: layoutRow } = user
    ? await supabase.from("ui_dashboard_layout").select("layout").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const dashboardLayout = normalizeDashboardLayout(layoutRow?.layout);

  const [
    salesItems,
    purchaseItems,
    carryoverWorkSales,
    carryoverWorkPurchases,
    salesPaperCalcs,
    purchasePaperCalcs,
    { data: paperStockProduct },
    { data: notes },
    { data: recentNotes },
    { data: company },
    carryoverInSales,
    carryoverInPurchases,
    { data: myProfile },
    notifications,
    stockLookupProductRows,
  ] = await Promise.all([
    // 매출/매입 라인아이템은 거래량이 많은 테넌트에서 한 달에 PostgREST
    // 기본 max_rows(1000)를 쉽게 넘을 수 있어, 메인 대시보드 집계가
    // 조용히 과소 집계되는 걸 막으려고 fetchAllRows로 끝까지 받는다
    // (월별 리포트/VAT/손익계산서 등 다른 집계 화면과 같은 이유).
    fetchAllRows((from, to) =>
      supabase
        .from("sales_order_items")
        .select(
          "id, quantity, unit_price, spec, remark, custom_name, sales_order_id, products(sku, name, unit, spec, base_package_qty, categories(name)), sales_orders!inner(order_date, is_return, is_carryover, created_at, customers(name))"
        )
        .gte("sales_orders.order_date", monthStart)
        .lte("sales_orders.order_date", monthEnd)
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("purchase_order_items")
        .select(
          "id, quantity, unit_cost, spec, remark, custom_name, purchase_order_id, products(sku, name, unit, spec, base_package_qty, categories(name)), purchase_orders!inner(purchase_date, is_carryover, created_at, suppliers(name))"
        )
        .gte("purchase_orders.purchase_date", monthStart)
        .lte("purchase_orders.purchase_date", monthEnd)
        .range(from, to),
    ),
    // 이월 건은 전표날짜가 이번 달 밖(예: 9/30 작업 -> 10/1 전표)일 수도
    // 있어, 위 order_date 기준 조회로는 아예 안 잡힌다 — 실제 작업일
    // (created_at)이 이번 달인 이월 건만 따로 걷어서 "오늘의 업무"에
    // 채운다(전표날짜/월별 집계에는 영향 없음, 아래 본문 루프 참고).
    fetchAllRows((from, to) =>
      supabase
        .from("sales_order_items")
        .select(
          "id, quantity, unit_price, spec, remark, custom_name, sales_order_id, products(sku, name, unit, spec, base_package_qty, categories(name)), sales_orders!inner(order_date, is_return, is_carryover, created_at, customers(name))"
        )
        .eq("sales_orders.is_carryover", true)
        .gte("sales_orders.created_at", workDateRange.start)
        .lt("sales_orders.created_at", workDateRange.end)
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("purchase_order_items")
        .select(
          "id, quantity, unit_cost, spec, remark, custom_name, purchase_order_id, products(sku, name, unit, spec, base_package_qty, categories(name)), purchase_orders!inner(purchase_date, is_carryover, created_at, suppliers(name))"
        )
        .eq("purchase_orders.is_carryover", true)
        .gte("purchase_orders.created_at", workDateRange.start)
        .lt("purchase_orders.created_at", workDateRange.end)
        .range(from, to),
    ),
    paperCalcEnabled
      ? fetchAllRows((from, to) =>
          supabase
            .from("paper_calculations")
            .select("input_items, sales_orders!inner(order_date, customers(name))")
            .gte("sales_orders.order_date", monthStart)
            .lte("sales_orders.order_date", monthEnd)
            .range(from, to),
        )
      : Promise.resolve([] as { input_items: unknown; sales_orders: { order_date: string; customers: { name: string } | null } }[]),
    paperCalcEnabled
      ? fetchAllRows((from, to) =>
          supabase
            .from("paper_calculations")
            .select("input_items, purchase_orders!inner(purchase_date, suppliers(name))")
            .gte("purchase_orders.purchase_date", monthStart)
            .lte("purchase_orders.purchase_date", monthEnd)
            .range(from, to),
        )
      : Promise.resolve([] as { input_items: unknown; purchase_orders: { purchase_date: string; suppliers: { name: string } | null } }[]),
    paperCalcEnabled
      ? supabase.from("products").select("name").eq("sku", PAPER_STOCK_SKU).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
    supabase
      .from("calendar_notes")
      .select("id, note_date, content, created_at, created_by, profiles!created_by(full_name)")
      .gte("note_date", monthStart)
      .lte("note_date", monthEnd)
      .order("created_at", { ascending: true }),
    supabase
      .from("calendar_notes")
      .select("id, note_date, content, profiles!created_by(full_name)")
      .gte("note_date", monthStart)
      .lte("note_date", monthEnd)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("company_profile").select("name, logo_mark_url").maybeSingle(),
    fetchAllRows((from, to) =>
      supabase
        .from("sales_order_items")
        .select("quantity, unit_price, sales_orders!inner(order_date, is_return, is_carryover)")
        .eq("sales_orders.is_carryover", true)
        .gte("sales_orders.order_date", prevMonthStart)
        .lte("sales_orders.order_date", prevMonthEnd)
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("purchase_order_items")
        .select("quantity, unit_cost, purchase_orders!inner(purchase_date, is_carryover)")
        .eq("purchase_orders.is_carryover", true)
        .gte("purchase_orders.purchase_date", prevMonthStart)
        .lte("purchase_orders.purchase_date", prevMonthEnd)
        .range(from, to),
    ),
    user
      ? supabase.from("profiles").select("tenant_id, is_demo").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? getNotificationSummary(supabase, user.id)
      : Promise.resolve({ announcements: [], todos: [], lowStock: [] }),
    // 대시보드 "퀵 재고조회" 패널용 — 재고관리 > 재고현황과 같은 products+
    // inventory 조인(sumInventoryQuantity 기준)을 그대로 써서, 재고현황
    // 화면과 항상 같은 수치를 보여준다.
    fetchAllRows<{
      id: string;
      sku: string;
      name: string;
      spec: string | null;
      unit: string;
      base_package_qty: number | null;
      reorder_point: number | null;
      categories: { name: string } | null;
      inventory: { quantity: number; warehouse_id: string }[];
    }>((from, to) =>
      supabase
        .from("products")
        .select(
          "id, sku, name, spec, unit, base_package_qty, reorder_point, categories(name), inventory(quantity, warehouse_id)"
        )
        .order("name")
        .range(from, to),
    ),
  ]);

  const stockLookupProducts: StockLookupProduct[] = stockLookupProductRows.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    spec: p.spec,
    unit: p.unit,
    categoryName: p.categories?.name ?? null,
    basePackageQty: p.base_package_qty,
    reorderPoint: p.reorder_point,
    quantity: sumInventoryQuantity(p.inventory),
  }));

  const unreadAnnouncements = notifications.announcements;
  const dueSoonTodos = notifications.todos;
  const lowStockItems = notifications.lowStock;

  // 전월에 이월로 등록된 건(실제 처리일은 전월, 실적은 이번 달)의 금액을
  // 이번 달 매출/매입 합계에 더한다 — 반품은 부호를 뒤집는다(다른 곳과 동일).
  const carryoverInSalesTotal = (carryoverInSales ?? []).reduce(
    (sum, r) => sum + r.quantity * Number(r.unit_price) * (r.sales_orders?.is_return ? -1 : 1),
    0
  );
  const carryoverInPurchaseTotal = (carryoverInPurchases ?? []).reduce(
    (sum, r) => sum + r.quantity * Number(r.unit_cost),
    0
  );

  type ItemRow = {
    partnerName: string;
    productName: string;
    // Filter 카테고리만 빼고 매입-매출 매칭(입고처/출고처/재고분출고)을
    // 추적한다(dashboard-calendar.tsx의 isTrackedCategory 참고) — Filter는
    // 같은 날 사고파는 매칭 정보가 실무에 큰 의미가 없다는 판단.
    categoryName: string | null;
    sku: string | null;
    spec: string;
    unit: string;
    quantity: number;
    basePackageQty: number | null;
    amount: number;
    orderId: string;
    // 이 줄의 원본 sales_order_items/purchase_order_items 행 id —
    // fifo_consumptions 매칭 계산에만 쓰고 화면에는 표시하지 않는다.
    itemId: string;
    remark: string | null;
    isCarryover: boolean;
    isReturn: boolean;
    // 아래 두 필드는 품목/규격/수량만 보고 "아마 같은 거래"로 짐작하던
    // 예전 추정 매칭을 걷어내고, fifo_consumptions(실제 소진 이력)로 채운
    // 진짜 데이터다 — 이 파일 맨 아래에서 한꺼번에 계산해 채운다.
    // 매입 품목: 오늘 이 매입분이 실제로 어느 거래처로(fifo 소진 기준)
    // 나갔는지. 매출 품목에서는 항상 빈 배열.
    realDestinations: { partnerName: string; quantity: number }[];
    // 매출 품목: 이 판매 수량 중 "오늘 들어온 매입"이 아니라 재고(과거
    // 매입분)에서 실제로 소진된 수량. 매입 품목에서는 항상 0.
    stockConsumedQuantity: number;
  };

  type PaperCalcPartnerEntry = { sizes: PaperCalcSizeRow[]; totalSheet: number; amount: number };

  // 이월 건의 전표날짜(order_date) 쪽 캘린더에 "다른 날 작업분이 여기로
  // 이월되어 왔다"고 표시하기 위한 요약 — 실제 항목 상세는 그 작업일
  // (fromDate) 쪽 캘린더에서 보여주고, 여기서는 건수만 가볍게 모은다.
  type CarryoverInSummary = { fromDate: string; itemCount: number };

  type DayData = {
    salesCount: number;
    salesTotal: number;
    salesItems: ItemRow[];
    purchaseCount: number;
    purchaseTotal: number;
    purchaseItems: ItemRow[];
    salesPaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
    purchasePaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
    carryoverInSales: CarryoverInSummary[];
    carryoverInPurchases: CarryoverInSummary[];
    notes: {
      id: string;
      authorName: string;
      content: string;
      createdAt: string;
      createdBy: string | null;
    }[];
    calendarItems: CalendarItem[];
  };

  const dataByDate: Record<string, DayData> = {};

  function ensure(date: string): DayData {
    if (!dataByDate[date]) {
      dataByDate[date] = {
        salesCount: 0,
        salesTotal: 0,
        salesItems: [],
        purchaseCount: 0,
        purchaseTotal: 0,
        purchaseItems: [],
        salesPaperCalcByPartner: {},
        purchasePaperCalcByPartner: {},
        carryoverInSales: [],
        carryoverInPurchases: [],
        notes: [],
        calendarItems: [],
      };
    }
    return dataByDate[date];
  }

  function addCarryoverIn(list: CarryoverInSummary[], fromDate: string) {
    const entry = list.find((e) => e.fromDate === fromDate);
    if (entry) entry.itemCount += 1;
    else list.push({ fromDate, itemCount: 1 });
  }

  // 거래처별로 모조지 계산 사이즈를 누적한다. 매출/매입 목록에서 거래처 이름
  // 아래에 "모조지" 카테고리로 같이 묶어 보여주기 위함(어느 거래처로 나간
  // 모조지인지 알 수 있게).
  function ensurePaperCalcPartner(
    byPartner: Record<string, PaperCalcPartnerEntry>,
    partnerName: string
  ): PaperCalcPartnerEntry {
    if (!byPartner[partnerName]) {
      byPartner[partnerName] = { sizes: [], totalSheet: 0, amount: 0 };
    }
    return byPartner[partnerName];
  }

  // paper_calculations.input_items는 사이즈별 내역(참고용 줄)을 보여주는
  // 데만 쓴다. 자동 계산값(total_sheet)은 여기서 더하지 않는다 — 거래처
  // 협의로 TG0 수량을 수동 오버라이드한 주문은 sales_order_items.quantity가
  // 이미 오버라이드된 값으로 반영돼 있는데, 여기서 total_sheet(자동값)를
  // 따로 또 더하면 대시보드에만 오버라이드 적용 전 수량이 보이는 문제가
  // 생긴다. 연 합계는 아래 품목 순회에서 실제 quantity로 채운다.
  function addPaperCalcSizesForPartner(
    byPartner: Record<string, PaperCalcPartnerEntry>,
    partnerName: string,
    inputItems: unknown
  ) {
    const entry = ensurePaperCalcPartner(byPartner, partnerName);
    entry.sizes = mergePaperCalcInputItems(entry.sizes, inputItems);
  }

  type SalesItemRow = NonNullable<typeof salesItems>[number];
  type PurchaseItemRow = NonNullable<typeof purchaseItems>[number];

  // 품목 행 id -> 실제로 버킷에 담긴 날짜(workDate). fifo_consumptions로
  // "오늘 매입 -> 오늘 출고"를 판정할 때, 매입/매출 양쪽 다 전표날짜가
  // 아니라 이 workDate로 "같은 날"을 비교한다 — 이월 건은 전표날짜와
  // workDate가 다를 수 있어서, 전표날짜끼리 비교하면 이월 건이 엉뚱하게
  // 안 맞아떨어진다.
  const purchaseItemWorkDateById = new Map<string, string>();
  const salesItemWorkDateById = new Map<string, string>();

  // 매출 한 줄을 실제로 잡을 날짜(workDate) 기준 버킷에 채운다 — 일반
  // 건은 전표날짜(order_date)가 곧 작업일이라 그대로 넘기고, 이월 건은
  // 호출부(아래 두 루프)에서 각자 맞는 날짜를 넘긴다. includeInTotal이
  // false면(이월 건) 금액은 그 달 salesTotal에 더하지 않는다 — 그만큼은
  // carryoverInSalesTotal이 회계상 맞는 달의 monthSalesTotal에 더해준다.
  function addSalesItem(item: SalesItemRow, workDate: string, includeInTotal: boolean) {
    const isReturn = item.sales_orders.is_return;
    // 반품 건은 재고가 늘어나는 반대 방향 거래라 매출 합계에서 차감해야
    // 하므로, 이 라인의 금액 자체를 음수로 뒤집어서 담는다.
    const amount = item.quantity * Number(item.unit_price) * (isReturn ? -1 : 1);
    const bucket = ensure(workDate);
    salesItemWorkDateById.set(item.id, workDate);
    bucket.salesCount += 1;
    if (includeInTotal) bucket.salesTotal += amount;
    // 모조지(TG0) 라인은 계산에서 자동 반영된 것이라 규격이 없다.
    // 아래 "모조지 사용량" 섹션에서 사이즈별로 정확히 보여주므로 목록에는
    // 넣지 않되, 이 라인의 실제 금액은 그 섹션의 합계 가격으로 옮겨 담는다.
    if (item.products?.sku === PAPER_STOCK_SKU) {
      const partnerName = item.sales_orders.customers?.name ?? "출고처 미상";
      const entry = ensurePaperCalcPartner(bucket.salesPaperCalcByPartner, partnerName);
      entry.amount += amount;
      entry.totalSheet += item.quantity;
      return;
    }
    bucket.salesItems.push({
      partnerName: item.sales_orders.customers?.name ?? "출고처 미상",
      productName: item.products?.name ?? item.custom_name ?? "상품 미상",
      categoryName: item.products?.categories?.name ?? null,
      sku: item.products?.sku ?? null,
      spec: item.spec || item.products?.spec || "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      basePackageQty: item.products?.base_package_qty ?? null,
      amount,
      orderId: item.sales_order_id,
      itemId: item.id,
      remark: item.remark,
      isCarryover: item.sales_orders.is_carryover,
      isReturn,
      realDestinations: [],
      stockConsumedQuantity: 0,
    });
  }

  function addPurchaseItem(item: PurchaseItemRow, workDate: string, includeInTotal: boolean) {
    const amount = item.quantity * Number(item.unit_cost);
    const bucket = ensure(workDate);
    purchaseItemWorkDateById.set(item.id, workDate);
    bucket.purchaseCount += 1;
    if (includeInTotal) bucket.purchaseTotal += amount;
    if (item.products?.sku === PAPER_STOCK_SKU) {
      const partnerName = item.purchase_orders.suppliers?.name ?? "공급처 미상";
      const entry = ensurePaperCalcPartner(bucket.purchasePaperCalcByPartner, partnerName);
      entry.amount += amount;
      entry.totalSheet += item.quantity;
      return;
    }
    bucket.purchaseItems.push({
      partnerName: item.purchase_orders.suppliers?.name ?? "공급처 미상",
      productName: item.products?.name ?? item.custom_name ?? "상품 미상",
      categoryName: item.products?.categories?.name ?? null,
      sku: item.products?.sku ?? null,
      spec: item.spec || item.products?.spec || "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      basePackageQty: item.products?.base_package_qty ?? null,
      amount,
      orderId: item.purchase_order_id,
      itemId: item.id,
      remark: item.remark,
      isCarryover: item.purchase_orders.is_carryover,
      isReturn: false,
      realDestinations: [],
      stockConsumedQuantity: 0,
    });
  }

  for (const item of salesItems ?? []) {
    const orderDate = item.sales_orders.order_date;
    if (item.sales_orders.is_carryover) {
      // 이월 건은 실제 작업일(created_at) 기준 버킷은 아래
      // carryoverWorkSales 루프에서 따로 채운다 — 여기서는 전표날짜
      // (order_date)가 작업일과 다를 때만, 전표날짜 쪽 캘린더에 "이월
      // 유입" 표시를 남긴다.
      const workDate = toKstDateStr(new Date(item.sales_orders.created_at));
      if (workDate !== orderDate) {
        addCarryoverIn(ensure(orderDate).carryoverInSales, workDate);
      }
      continue;
    }
    addSalesItem(item, orderDate, true);
  }

  for (const item of carryoverWorkSales ?? []) {
    const workDate = toKstDateStr(new Date(item.sales_orders.created_at));
    addSalesItem(item, workDate, false);
  }

  for (const item of purchaseItems ?? []) {
    const orderDate = item.purchase_orders.purchase_date;
    if (item.purchase_orders.is_carryover) {
      const workDate = toKstDateStr(new Date(item.purchase_orders.created_at));
      if (workDate !== orderDate) {
        addCarryoverIn(ensure(orderDate).carryoverInPurchases, workDate);
      }
      continue;
    }
    addPurchaseItem(item, orderDate, true);
  }

  for (const item of carryoverWorkPurchases ?? []) {
    const workDate = toKstDateStr(new Date(item.purchase_orders.created_at));
    addPurchaseItem(item, workDate, false);
  }

  // "오늘의 업무" 패널의 매입/매출 목적지 표시는 예전엔 품목+규격+수량이
  // 맞아떨어지면 "아마 같은 거래"로 짐작하는 추정 매칭이었다 — 수량이
  // 우연히 맞아떨어지면 실제로는 재고에서 나간 매출을 오늘 매입으로
  // 잘못 엮어 보여주는 문제가 있었다(예: "나영식테크 532kg"이 재고분
  // 출고였는데 오늘 매입으로 표시됨). FIFO 소진 이력(fifo_consumptions)이
  // 실제 매입-매출 연결을 정확히 갖고 있으니, 그걸로 교체한다.
  const purchaseIds = [...purchaseItemWorkDateById.keys()];
  const salesIds = [...salesItemWorkDateById.keys()];

  const [purchaseConsumptionRows, salesConsumptionRows] = await Promise.all([
    purchaseIds.length
      ? fetchAllRows((from, to) =>
          supabase
            .from("fifo_consumptions")
            .select(
              "purchase_order_item_id, sales_order_item_id, consumed_quantity, sales_order_items!inner(sales_orders!inner(customers(name)))"
            )
            .eq("consumed_by_type", "sale")
            .in("purchase_order_item_id", purchaseIds)
            .range(from, to),
        )
      : Promise.resolve(
          [] as {
            purchase_order_item_id: string;
            sales_order_item_id: string;
            consumed_quantity: number;
            sales_order_items: { sales_orders: { customers: { name: string } | null } };
          }[]
        ),
    salesIds.length
      ? fetchAllRows((from, to) =>
          supabase
            .from("fifo_consumptions")
            .select("purchase_order_item_id, sales_order_item_id, consumed_quantity")
            .eq("consumed_by_type", "sale")
            .in("sales_order_item_id", salesIds)
            .range(from, to),
        )
      : Promise.resolve(
          [] as { purchase_order_item_id: string; sales_order_item_id: string; consumed_quantity: number }[]
        ),
  ]);

  // 매입 품목 id -> 그 매입분을 실제로 소진한 매출의 거래처별 수량.
  // 예전엔 양쪽 workDate(전표날짜가 아니라 실제 작업일)가 같아야만 인정했는데,
  // 그러면 드랍십(매출 전표를 먼저 끊고 매입을 나중에 입력하는 경우)처럼
  // fifo_consumptions가 실제로는 정확히 연결돼 있어도 두 작업일이 다르다는
  // 이유만으로 "재고용 매입"/"재고분 출고"로 잘못 갈라져 보이는 문제가 있었다.
  // fifo_consumptions 자체가 이미 "진짜 연결"이므로, 날짜 일치 여부와 무관하게
  // 있는 그대로 믿는다 — 라고 했었지만, 지금은 아래 루프에서 "같은 날 작업분"
  // 끼리만 인정한다(사용자 규칙). 다른 날 연결은 이 패널에 표시하지 않는다.
  const purchaseDestinationsById = new Map<string, { partnerName: string; quantity: number }[]>();
  for (const row of purchaseConsumptionRows) {
    // consumed_by_type='sale'로 걸러서 실제로는 항상 채워져 있지만, 컬럼
    // 자체는(로스 소진 건도 같은 테이블을 쓰느라) nullable이라 타입상
    // 널 체크가 필요하다.
    if (!row.sales_order_item_id) continue;
    // 사용자 규칙: 오늘의 업무에서 매입-매출 연결(목적지 표시)은 "같은 날" 작업된
    // 건끼리만 한다. 매출이 다른 날 것이면(예: 며칠 전 먼저 끊어둔 매출) 그 거래처를
    // 오늘 매입 옆에 붙이지 않는다 — 안 그러면 오늘 안 나간 거래처가 매입에 떠서
    // 혼동된다(예: 재고로 정상 입고된 커버테이프에 거래처가 붙던 문제).
    const purchaseWorkDate = purchaseItemWorkDateById.get(row.purchase_order_item_id);
    const saleWorkDate = salesItemWorkDateById.get(row.sales_order_item_id);
    if (!purchaseWorkDate || purchaseWorkDate !== saleWorkDate) continue;
    const partnerName = row.sales_order_items.sales_orders.customers?.name ?? "출고처 미상";
    const list = purchaseDestinationsById.get(row.purchase_order_item_id) ?? [];
    list.push({ partnerName, quantity: row.consumed_quantity });
    purchaseDestinationsById.set(row.purchase_order_item_id, list);
  }

  // 매출 품목 id -> 실제로 소진에 쓰인 매입분 수량(날짜 무관, 위와 같은 이유).
  // (전체 수량 - 이 값) = 어느 매입으로도 안 엮인(또는 아직 매입이 입력 안 된)
  // 몫 = 재고(과거 매입분)에서 나간 수량 = "재고분 출고".
  const salesTodayPurchaseQtyById = new Map<string, number>();
  for (const row of salesConsumptionRows) {
    if (!row.sales_order_item_id) continue;
    salesTodayPurchaseQtyById.set(
      row.sales_order_item_id,
      (salesTodayPurchaseQtyById.get(row.sales_order_item_id) ?? 0) + row.consumed_quantity,
    );
  }

  for (const day of Object.values(dataByDate)) {
    for (const item of day.purchaseItems) {
      item.realDestinations = purchaseDestinationsById.get(item.itemId) ?? [];
    }
    for (const item of day.salesItems) {
      const todayPurchaseQty = salesTodayPurchaseQtyById.get(item.itemId) ?? 0;
      item.stockConsumedQuantity = Math.max(item.quantity - todayPurchaseQty, 0);
    }
  }

  for (const calc of salesPaperCalcs ?? []) {
    const bucket = ensure(calc.sales_orders.order_date);
    const partnerName = calc.sales_orders.customers?.name ?? "출고처 미상";
    addPaperCalcSizesForPartner(bucket.salesPaperCalcByPartner, partnerName, calc.input_items);
  }

  for (const calc of purchasePaperCalcs ?? []) {
    const bucket = ensure(calc.purchase_orders.purchase_date);
    const partnerName = calc.purchase_orders.suppliers?.name ?? "공급처 미상";
    addPaperCalcSizesForPartner(bucket.purchasePaperCalcByPartner, partnerName, calc.input_items);
  }

  for (const note of notes ?? []) {
    ensure(note.note_date).notes.push({
      id: note.id,
      authorName: note.profiles?.full_name ?? "익명",
      content: note.content,
      createdAt: note.created_at,
      createdBy: note.created_by,
    });
  }

  // 회사 캘린더(/calendar)의 회의·기타 일정 + 승인된 연차를 대시보드 달력에도
  // 그대로 얹는다 — /calendar 화면과 같은 조회 함수를 써서 두 화면이
  // 어긋나지 않게 한다.
  if (myProfile) {
    const calendarItems = await getCalendarItems(supabase, {
      from: `${monthStart}T00:00:00`,
      to: `${monthEnd}T23:59:59`,
      tenantId: myProfile.tenant_id,
      isDemo: myProfile.is_demo,
    });
    for (const item of calendarItems) {
      let cur = item.startAt.slice(0, 10);
      const end = item.endAt.slice(0, 10);
      let guard = 0;
      while (cur <= end && guard < 366) {
        if (cur >= monthStart && cur <= monthEnd) {
          ensure(cur).calendarItems.push(item);
        }
        const d = new Date(`${cur}T00:00:00`);
        d.setDate(d.getDate() + 1);
        cur = d.toLocaleDateString("sv-SE");
        guard += 1;
      }
    }
  }

  const weeks = buildWeeks(year, month);

  // "오늘 리포트" 박스의 수금·지급·잔액. 부서별 화면 접근 권한(미수금현황/미지급금현황)을
  // 그대로 따른다 — 권한 없는 쪽은 null로 내려 박스가 그 칸을 그리지 않는다.
  const [canSeeReceivables, canSeePayables] = await Promise.all([
    canViewPage(supabase, "/receivables"),
    canViewPage(supabase, "/payables"),
  ]);
  const sumPaymentsByDate = (rows: { paid_at: string; amount: string | number }[]) => {
    const byDate: Record<string, number> = {};
    for (const row of rows) byDate[row.paid_at] = (byDate[row.paid_at] ?? 0) + Number(row.amount);
    return byDate;
  };
  const [collectedRows, paidRows, customerBalances, supplierBalances] = await Promise.all([
    canSeeReceivables
      ? fetchAllRows<{ paid_at: string; amount: string | number }>((from, to) =>
          supabase.from("customer_payments").select("paid_at, amount").gte("paid_at", monthStart).lte("paid_at", monthEnd).range(from, to),
        )
      : Promise.resolve(null),
    canSeePayables
      ? fetchAllRows<{ paid_at: string; amount: string | number }>((from, to) =>
          supabase.from("supplier_payments").select("paid_at, amount").gte("paid_at", monthStart).lte("paid_at", monthEnd).range(from, to),
        )
      : Promise.resolve(null),
    canSeeReceivables ? getAllCustomerBalances(supabase) : Promise.resolve(null),
    canSeePayables ? getAllSupplierBalances(supabase) : Promise.resolve(null),
  ]);
  const reportMoney: ReportMoney | null =
    canSeeReceivables || canSeePayables
      ? {
          collectedByDate: collectedRows ? sumPaymentsByDate(collectedRows) : null,
          paidByDate: paidRows ? sumPaymentsByDate(paidRows) : null,
          receivable: customerBalances
            ? { amount: sumOutstandingBalance(customerBalances), parties: customerBalances.filter((b) => b.balance > 0).length }
            : null,
          payable: supplierBalances
            ? { amount: sumOutstandingBalance(supplierBalances), parties: supplierBalances.filter((b) => b.balance > 0).length }
            : null,
        }
      : null;

  // 오늘 매출/매입, 재고위험 건수는 전부 바로 아래 달력 옆 "오늘의 업무"
  // 패널과 "재고위험" 패널에 이미 자세히 나오는 정보라, 요약 카드에는
  // 그 두 패널에는 없는(달력은 하루치만 보여줌) 이번달 누계만 둔다.
  // 이번 달 합계에는 전월에서 넘어온 이월(carryoverIn) 금액도 더한다 —
  // 그 건들은 실제 처리일이 전월이라 dataByDate(이번 달 달력)에는 잡히지
  // 않지만, 회계상 실적은 이번 달 몫이다.
  const monthSalesTotal =
    Object.values(dataByDate).reduce((sum, day) => sum + day.salesTotal, 0) + carryoverInSalesTotal;
  const monthSalesCount = Object.values(dataByDate).reduce((sum, day) => sum + day.salesCount, 0);
  const monthPurchaseTotal =
    Object.values(dataByDate).reduce((sum, day) => sum + day.purchaseTotal, 0) + carryoverInPurchaseTotal;
  const monthPurchaseCount = Object.values(dataByDate).reduce((sum, day) => sum + day.purchaseCount, 0);

  const hasAlerts =
    unreadAnnouncements.length > 0 || dueSoonTodos.length > 0 || lowStockItems.length > 0;

  // 대시보드에서 공지/할일을 열었다가 닫으면 그 레코드의 기본 목록이
  // 아니라 대시보드로 돌아와야 한다(사용자 지적 — "상세보기 끄면 엉뚱한
  // 메뉴로 이동해버린다").
  const dashboardBack = buildBackHref("/dashboard");

  // 위젯으로 나뉘는 서버 렌더링 조각들 — 어디에 어떤 크기로 놓을지는 사용자가 저장한 배치(DashboardWidgetGrid)가 정한다.
  // 오늘 데이터는 지금 보는 달 안에 있을 때만 알 수 있다(다른 달을 보면 null로 두고 "—"로 보여준다).
  const todayData = dataByDate[todayStr] as DayData | undefined;
  const todayInView = todayStr.startsWith(`${year}-${String(month).padStart(2, "0")}`);
  const sources = await resolveDashboardSources({
    supabase,
    userId: user?.id ?? null,
    todayStr,
    backHref: dashboardBack,
    selection: dashboardLayout.sources,
    customerBalances,
    supplierBalances,
    todos: dueSoonTodos,
    carryovers: [
      ...(todayData?.carryoverInSales ?? []).map((c) => ({ ...c, kind: "sales" as const })),
      ...(todayData?.carryoverInPurchases ?? []).map((c) => ({ ...c, kind: "purchase" as const })),
    ],
    lowStock: lowStockItems,
    announcements: unreadAnnouncements,
  });
  const overdueCustomers = sources.overdueCustomers;
  const firstEvent = todayData?.calendarItems[0];
  const tabsOf = (ids: SourceId[]) =>
    ids.filter((id) => sources.itemsOf(id) !== null).map((id) => ({ id, title: sourceMeta(id).title, items: sources.itemsOf(id) ?? [] }));
  const sidePanels = {
    kpi: (
      <DashboardKpiStrip
        todayStr={todayStr}
        sales={todayInView ? { count: todayData?.salesCount ?? 0, total: todayData?.salesTotal ?? 0 } : null}
        purchase={todayInView ? { count: todayData?.purchaseCount ?? 0, total: todayData?.purchaseTotal ?? 0 } : null}
        receivable={
          reportMoney?.receivable ? { amount: reportMoney.receivable.amount, parties: reportMoney.receivable.parties, overdueCount: overdueCustomers.length } : null
        }
        lowStock={{ count: lowStockItems.length, first: lowStockItems[0] ? `${lowStockItems[0].name} · 현재 ${lowStockItems[0].quantity} / 기준 ${lowStockItems[0].reorderPoint}` : null }}
        events={todayInView ? { count: todayData?.calendarItems.length ?? 0, first: firstEvent ? `${firstEvent.allDay ? "종일" : firstEvent.startAt.slice(11, 16)} ${firstEvent.title}` : null } : null}
      />
    ),
    todo: <DashboardTodoPanel tabs={tabsOf(dashboardLayout.sources.todo)} />,
    news: <DashboardTodoPanel label="소식 종류" empty="새 소식이 없습니다." tabs={tabsOf(dashboardLayout.sources.news)} />,
    listA: <DashboardSourcePanel sourceId={dashboardLayout.sources.listA} items={sources.itemsOf(dashboardLayout.sources.listA)} />,
    listB: <DashboardSourcePanel sourceId={dashboardLayout.sources.listB} items={sources.itemsOf(dashboardLayout.sources.listB)} />,
    lookup: <QuickStockLookup products={stockLookupProducts} />,
    memos: <RecentMemosPanel notes={recentNotes} />,
    quick: <QuickActionsPanel showReceivables={!!customerBalances} />,
  };

  return (
    <>
      <OnboardingBanner />
      {hasAlerts && (
        <div className="erp-alert-banner">
          {unreadAnnouncements.slice(0, 3).map((a) => (
            <Link key={`a-${a.id}`} href={`/announcements/${a.id}?back=${dashboardBack}`} className="erp-alert-item">
              <span className="erp-alert-tag">공지</span>
              {a.pinned ? "📌 " : ""}
              {a.title}
            </Link>
          ))}
          {dueSoonTodos.slice(0, 10).map((t) => {
            const overdue = !!t.due_date && t.due_date < todayStr;
            const itemCount = t.itemCount;
            return (
              <Link
                key={`d-${t.id}`}
                href={`/todos/${t.id}?back=${dashboardBack}`}
                className={`erp-alert-item${overdue ? " danger" : ""}`}
              >
                <span className={`erp-alert-tag${overdue ? " danger" : ""}`}>{overdue ? "지연" : "할 일"}</span>
                {t.title}
                {t.due_date ? ` (${t.due_date})` : ""}
                <GridBadge tone="muted" style={{ marginLeft: 6 }}>
                  {todoTypeLabel(t.todoType, t.shipDate, t.due_date)}
                </GridBadge>
                {itemCount > 0 && (
                  <GridBadge tone="muted" style={{ marginLeft: 4 }}>
                    품목 {itemCount}건
                  </GridBadge>
                )}
              </Link>
            );
          })}
          {lowStockItems.length > 0 && (
            <Link href="#stock-risk" className="erp-alert-item danger">
              <span className="erp-alert-tag danger">재고</span>
              안전재고 이하 품목이 {lowStockItems.length}건 있습니다 — 자세히 보기 →
            </Link>
          )}
        </div>
      )}
      <div className="erp-home">
      <DashboardCalendar
        year={year}
        month={month}
        weeks={weeks}
        dataByDate={dataByDate}
        todayStr={todayStr}
        prevMonthHref={prevMonthHref}
        nextMonthHref={nextMonthHref}
        backgroundLogoUrl={company?.logo_mark_url}
        lowStockToday={lowStockItems.length > 0}
        paperStockProductName={paperStockProduct?.name ?? "모조지"}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        reportMoney={reportMoney}
        monthTotals={{
          salesCount: monthSalesCount,
          salesTotal: monthSalesTotal,
          purchaseCount: monthPurchaseCount,
          purchaseTotal: monthPurchaseTotal,
        }}
        lowStock={lowStockItems.map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, reorderPoint: p.reorderPoint }))}
        layout={dashboardLayout}
        sourceOptions={sources.options}
        sidePanels={sidePanels}
      />
      </div>
    </>
  );
}

export default withPageTiming("dashboard", DashboardPage);
