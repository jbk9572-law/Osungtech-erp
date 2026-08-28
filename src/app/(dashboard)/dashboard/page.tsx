import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { getNotificationSummary } from "@/lib/notifications";
import { todoTypeLabel } from "@/lib/todo-flow";
import { mergePaperCalcInputItems, type PaperCalcSizeRow } from "@/lib/paper-calc-summary";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";
import { nowInKst } from "@/lib/kst-date";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
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

export default async function DashboardPage({
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { count: productCount },
    { data: salesItems },
    { data: purchaseItems },
    { data: salesPaperCalcs },
    { data: purchasePaperCalcs },
    { data: paperStockProduct },
    { data: notes },
    { data: recentNotes },
    { data: company },
    { data: carryoverInSales },
    { data: carryoverInPurchases },
    notifications,
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("sales_order_items")
      .select(
        "quantity, unit_price, spec, remark, sales_order_id, products(sku, name, unit, spec), sales_orders!inner(order_date, is_return, is_carryover, customers(name))"
      )
      .gte("sales_orders.order_date", monthStart)
      .lte("sales_orders.order_date", monthEnd),
    supabase
      .from("purchase_order_items")
      .select(
        "quantity, unit_cost, spec, remark, purchase_order_id, products(sku, name, unit, spec), purchase_orders!inner(purchase_date, is_carryover, suppliers(name))"
      )
      .gte("purchase_orders.purchase_date", monthStart)
      .lte("purchase_orders.purchase_date", monthEnd),
    supabase
      .from("paper_calculations")
      .select("input_items, sales_orders!inner(order_date, customers(name))")
      .gte("sales_orders.order_date", monthStart)
      .lte("sales_orders.order_date", monthEnd),
    supabase
      .from("paper_calculations")
      .select("input_items, purchase_orders!inner(purchase_date, suppliers(name))")
      .gte("purchase_orders.purchase_date", monthStart)
      .lte("purchase_orders.purchase_date", monthEnd),
    supabase.from("products").select("name").eq("sku", PAPER_STOCK_SKU).maybeSingle(),
    supabase
      .from("calendar_notes")
      .select("note_date, content")
      .gte("note_date", monthStart)
      .lte("note_date", monthEnd),
    supabase
      .from("calendar_notes")
      .select("note_date, content")
      .gte("note_date", monthStart)
      .lte("note_date", monthEnd)
      .order("note_date", { ascending: false })
      .limit(5),
    supabase.from("company_profile").select("name, logo_mark_url").eq("id", 1).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("quantity, unit_price, sales_orders!inner(order_date, is_return, is_carryover)")
      .eq("sales_orders.is_carryover", true)
      .gte("sales_orders.order_date", prevMonthStart)
      .lte("sales_orders.order_date", prevMonthEnd),
    supabase
      .from("purchase_order_items")
      .select("quantity, unit_cost, purchase_orders!inner(purchase_date, is_carryover)")
      .eq("purchase_orders.is_carryover", true)
      .gte("purchase_orders.purchase_date", prevMonthStart)
      .lte("purchase_orders.purchase_date", prevMonthEnd),
    user
      ? getNotificationSummary(supabase, user.id)
      : Promise.resolve({ announcements: [], todos: [], lowStock: [] }),
  ]);

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
    spec: string;
    unit: string;
    quantity: number;
    amount: number;
    orderId: string;
    remark: string | null;
    isCarryover: boolean;
    isReturn: boolean;
  };

  type PaperCalcPartnerEntry = { sizes: PaperCalcSizeRow[]; totalSheet: number; amount: number };

  type DayData = {
    salesCount: number;
    salesTotal: number;
    salesItems: ItemRow[];
    purchaseCount: number;
    purchaseTotal: number;
    purchaseItems: ItemRow[];
    salesPaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
    purchasePaperCalcByPartner: Record<string, PaperCalcPartnerEntry>;
    note: string;
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
        note: "",
      };
    }
    return dataByDate[date];
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

  for (const item of salesItems ?? []) {
    const date = item.sales_orders.order_date;
    const isReturn = item.sales_orders.is_return;
    const itemIsCarryover = item.sales_orders.is_carryover;
    // 반품 건은 재고가 늘어나는 반대 방향 거래라 매출 합계에서 차감해야
    // 하므로, 이 라인의 금액 자체를 음수로 뒤집어서 담는다 — 그러면
    // salesTotal 누계에도, 화면에 그대로 찍히는 개별 금액에도 부호가
    // 자연스럽게 반영된다.
    const amount = item.quantity * Number(item.unit_price) * (isReturn ? -1 : 1);
    const bucket = ensure(date);
    bucket.salesCount += 1;
    // 이월(is_carryover) 건은 실제로 오늘 처리한 거래라 건수에는 반영하되,
    // 금액은 다음 달 실적으로 잡히므로 이번 달 salesTotal에는 더하지
    // 않는다(그만큼은 위에서 구한 carryoverInSalesTotal이 "다음 달"의
    // monthSalesTotal에 더해준다).
    if (!itemIsCarryover) bucket.salesTotal += amount;
    // 모조지(TG0) 라인은 계산에서 자동 반영된 것이라 규격이 없다.
    // 아래 "모조지 사용량" 섹션에서 사이즈별로 정확히 보여주므로 목록에는
    // 넣지 않되, 이 라인의 실제 금액은 그 섹션의 합계 가격으로 옮겨 담는다.
    if (item.products?.sku === PAPER_STOCK_SKU) {
      const partnerName = item.sales_orders.customers?.name ?? "출고처 미상";
      const entry = ensurePaperCalcPartner(bucket.salesPaperCalcByPartner, partnerName);
      entry.amount += amount;
      entry.totalSheet += item.quantity;
      continue;
    }
    bucket.salesItems.push({
      partnerName: item.sales_orders.customers?.name ?? "출고처 미상",
      productName: item.products?.name ?? "상품 미상",
      spec: item.spec || item.products?.spec || "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      amount,
      orderId: item.sales_order_id,
      remark: item.remark,
      isCarryover: itemIsCarryover,
      isReturn,
    });
  }

  for (const item of purchaseItems ?? []) {
    const date = item.purchase_orders.purchase_date;
    const itemIsCarryover = item.purchase_orders.is_carryover;
    const amount = item.quantity * Number(item.unit_cost);
    const bucket = ensure(date);
    bucket.purchaseCount += 1;
    if (!itemIsCarryover) bucket.purchaseTotal += amount;
    if (item.products?.sku === PAPER_STOCK_SKU) {
      const partnerName = item.purchase_orders.suppliers?.name ?? "공급처 미상";
      const entry = ensurePaperCalcPartner(bucket.purchasePaperCalcByPartner, partnerName);
      entry.amount += amount;
      entry.totalSheet += item.quantity;
      continue;
    }
    bucket.purchaseItems.push({
      partnerName: item.purchase_orders.suppliers?.name ?? "공급처 미상",
      productName: item.products?.name ?? "상품 미상",
      spec: item.spec || item.products?.spec || "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      amount,
      orderId: item.purchase_order_id,
      remark: item.remark,
      isCarryover: itemIsCarryover,
      isReturn: false,
    });
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
    ensure(note.note_date).note = note.content;
  }

  const weeks = buildWeeks(year, month);

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

  return (
    <>
      <OnboardingBanner />
      {hasAlerts && (
        <div className="erp-alert-banner">
          {unreadAnnouncements.slice(0, 3).map((a) => (
            <Link key={`a-${a.id}`} href={`/announcements/${a.id}`} className="erp-alert-item">
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
                href={`/todos/${t.id}`}
                className={`erp-alert-item${overdue ? " danger" : ""}`}
              >
                <span className={`erp-alert-tag${overdue ? " danger" : ""}`}>{overdue ? "지연" : "할 일"}</span>
                {t.title}
                {t.due_date ? ` (${t.due_date})` : ""}
                <span className="erp-badge erp-badge-muted" style={{ marginLeft: 6 }}>
                  {todoTypeLabel(t.todoType, t.shipDate, t.due_date)}
                </span>
                {itemCount > 0 && (
                  <span className="erp-badge erp-badge-muted" style={{ marginLeft: 4 }}>
                    품목 {itemCount}건
                  </span>
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
      <div className="erp-hero-row">
        <div className="erp-hero-card" style={{ borderLeftColor: "var(--erp-success)" }}>
          <div className="erp-hero-label">이번달 매출</div>
          <div className="erp-hero-value">
            {monthSalesCount}건 · {monthSalesTotal.toLocaleString()}원
          </div>
        </div>
        <div className="erp-hero-card">
          <div className="erp-hero-label">이번달 매입</div>
          <div className="erp-hero-value">
            {monthPurchaseCount}건 · {monthPurchaseTotal.toLocaleString()}원
          </div>
        </div>
        <div className="erp-hero-card">
          <div className="erp-hero-label">전체 품목 수</div>
          <div className="erp-hero-value">{(productCount ?? 0).toLocaleString()}개</div>
        </div>
      </div>
      <div className="erp-home">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="erp-home-panel" id="stock-risk">
          <div className="erp-home-panel-title">
            <span>재고위험</span>
            {lowStockItems.length > 0 && (
              <span style={{ color: "var(--erp-danger)", fontVariantNumeric: "tabular-nums" }}>
                {lowStockItems.length}건
              </span>
            )}
          </div>
          {lowStockItems.length ? (
            <>
              <div className="erp-home-stock-list">
                {lowStockItems.map((p) => (
                  <Link key={p.id} href={`/inventory/${p.id}`} className="erp-home-stock-row">
                    <span className="name">{p.name}</span>
                    <span className="ratio">
                      현재 {p.quantity.toLocaleString()} / 기준 {p.reorderPoint.toLocaleString()}
                    </span>
                  </Link>
                ))}
              </div>
              <div className="erp-home-stock-footer">
                <Link href="/inventory">재고현황 전체 보기 →</Link>
                {" · "}
                <Link href="/inventory/reorder-suggestions">발주 제안 보기 →</Link>
              </div>
            </>
          ) : (
            <p className="erp-home-empty">안전재고 이하 품목이 없습니다.</p>
          )}
        </div>
      </div>

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
      />

      <div className="erp-home-panel">
        <div className="erp-home-panel-title">최근 메모</div>
        {recentNotes?.length ? (
          <div className="erp-home-list">
            {recentNotes.map((note) => (
              <div className="erp-home-list-item" key={note.note_date}>
                <span style={{ color: "var(--erp-text-muted)", fontSize: 11 }}>
                  {note.note_date}
                </span>
                <span className="truncate">{note.content}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="erp-home-empty">등록된 메모가 없습니다.</p>
        )}

        <div className="erp-home-panel-title" style={{ marginTop: 0 }}>
          빠른 실행
        </div>
        <div className="erp-home-list">
          <Link className="erp-home-list-item" href="/sales">
            새 판매 등록
          </Link>
          <Link className="erp-home-list-item" href="/purchases">
            새 입고 등록
          </Link>
          <Link className="erp-home-list-item" href="/products">
            품목 등록
          </Link>
          <Link className="erp-home-list-item" href="/inventory">
            재고 조회
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}
