import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { getNotificationSummary } from "@/lib/notifications";
import { todoTypeLabel } from "@/lib/todo-flow";
import { mergePaperCalcInputItems, type PaperCalcSizeRow } from "@/lib/paper-calc-summary";
import { PAPER_STOCK_SKU } from "@/lib/paper-calc-sync";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// "이월" 판정: 등록된 매출/매입 날짜(order_date)가, 실제로 그 건을 입력한
// 달(created_at)보다 나중인지 여부다. 회계상 날짜만 다음 달로 잡아둔 것일
// 뿐 실제 업무는 입력한 당일에 한 것이므로, 달력에는 order_date가 아니라
// created_at의 날짜(실제 입력일)에 정상적인 매출/매입 건 하나로 표시한다
// (아래 dataByDate 구성 부분 참고). order_date에 해당하는 달력 날짜에는
// 원래 매출/매입처럼 보이면 안 된다 — 이미 입력일 쪽에 표시하고 있으므로.
function isCarryover(orderDate: string, createdAt: string) {
  const created = new Date(createdAt);
  const createdMonth = `${created.getFullYear()}-${pad(created.getMonth() + 1)}`;
  return orderDate.slice(0, 7) > createdMonth;
}

function toLocalDateStr(iso: string) {
  const d = new Date(iso);
  return toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
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
  const now = new Date();
  const [year, month] = monthParam
    ? monthParam.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const monthStart = toDateStr(year, month, 1);
  const monthEnd = toDateStr(year, month, new Date(year, month, 0).getDate());

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const prevMonthHref = `/dashboard?month=${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}`;
  const nextMonthHref = `/dashboard?month=${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}`;

  const supabase = await createClient();
  const todayStr = toDateStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
  // 이월 후보를 DB에서 걸러낼 때, order_date와 created_at을 직접 비교하는
  // 조건은 PostgREST 필터로 표현할 수 없어(두 컬럼끼리 비교) 넉넉한 기간
  // 범위로 먼저 가져온 뒤 isCarryover()로 정확히 골라낸다. 실제로 이월
  // 등록은 항상 월말 즈음 다음 달 날짜로만 하므로, 지난 6개월~다음 3개월이면
  // 실사용에서 놓칠 일이 없다.
  const carryoverRangeStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const carryoverRangeEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0);
  const carryoverFrom = toDateStr(
    carryoverRangeStart.getFullYear(),
    carryoverRangeStart.getMonth() + 1,
    1
  );
  const carryoverTo = toDateStr(
    carryoverRangeEnd.getFullYear(),
    carryoverRangeEnd.getMonth() + 1,
    carryoverRangeEnd.getDate()
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
    { data: todaySales },
    { data: todayPurchases },
    { data: carryoverSales },
    { data: carryoverPurchases },
    notifications,
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("sales_order_items")
      .select(
        "quantity, unit_price, spec, remark, sales_order_id, products(sku, name, unit, spec), sales_orders!inner(order_date, created_at, customers(name))"
      )
      .gte("sales_orders.order_date", monthStart)
      .lte("sales_orders.order_date", monthEnd),
    supabase
      .from("purchase_order_items")
      .select(
        "quantity, unit_cost, spec, remark, purchase_order_id, products(sku, name, unit, spec), purchase_orders!inner(purchase_date, created_at, suppliers(name))"
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
      .order("note_date", { ascending: false })
      .limit(5),
    supabase.from("company_profile").select("name, logo_mark_url").eq("id", 1).maybeSingle(),
    supabase
      .from("sales_order_items")
      .select("quantity, unit_price, sales_orders!inner(order_date)")
      .eq("sales_orders.order_date", todayStr),
    supabase
      .from("purchase_order_items")
      .select("quantity, unit_cost, purchase_orders!inner(purchase_date)")
      .eq("purchase_orders.purchase_date", todayStr),
    supabase
      .from("sales_order_items")
      .select(
        "quantity, unit_price, spec, remark, sales_order_id, products(sku, name, unit, spec), sales_orders!inner(order_date, created_at, customers(name))"
      )
      .gte("sales_orders.order_date", carryoverFrom)
      .lte("sales_orders.order_date", carryoverTo)
      .order("order_date", { referencedTable: "sales_orders", ascending: true }),
    supabase
      .from("purchase_order_items")
      .select(
        "quantity, unit_cost, spec, remark, purchase_order_id, products(sku, name, unit, spec), purchase_orders!inner(purchase_date, created_at, suppliers(name))"
      )
      .gte("purchase_orders.purchase_date", carryoverFrom)
      .lte("purchase_orders.purchase_date", carryoverTo)
      .order("purchase_date", { referencedTable: "purchase_orders", ascending: true }),
    user
      ? getNotificationSummary(supabase, user.id)
      : Promise.resolve({ announcements: [], todos: [], lowStock: [] }),
  ]);

  const unreadAnnouncements = notifications.announcements;
  const dueSoonTodos = notifications.todos;
  const lowStockItems = notifications.lowStock;

  type ItemRow = {
    partnerName: string;
    productName: string;
    spec: string;
    unit: string;
    quantity: number;
    amount: number;
    orderId: string;
    remark: string | null;
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
    // 이월 건은 달력의 order_date 자리가 아니라 오늘의 업무 쪽에서만
    // 별도로 보여준다(아래 carryoverSalesItems 참고).
    if (isCarryover(date, item.sales_orders.created_at)) continue;
    const amount = item.quantity * Number(item.unit_price);
    const bucket = ensure(date);
    bucket.salesCount += 1;
    bucket.salesTotal += amount;
    // 모조지(TG0) 라인은 계산에서 자동 반영된 것이라 규격이 없다.
    // 아래 "모조지 사용량" 섹션에서 사이즈별로 정확히 보여주므로 목록에는
    // 넣지 않되, 이 라인의 실제 금액은 그 섹션의 합계 가격으로 옮겨 담는다.
    if (item.products?.sku === PAPER_STOCK_SKU) {
      const partnerName = item.sales_orders.customers?.name ?? "거래처 미상";
      const entry = ensurePaperCalcPartner(bucket.salesPaperCalcByPartner, partnerName);
      entry.amount += amount;
      entry.totalSheet += item.quantity;
      continue;
    }
    bucket.salesItems.push({
      partnerName: item.sales_orders.customers?.name ?? "거래처 미상",
      productName: item.products?.name ?? "상품 미상",
      spec: item.spec || item.products?.spec || "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      amount,
      orderId: item.sales_order_id,
      remark: item.remark,
    });
  }

  for (const item of purchaseItems ?? []) {
    const date = item.purchase_orders.purchase_date;
    if (isCarryover(date, item.purchase_orders.created_at)) continue;
    const amount = item.quantity * Number(item.unit_cost);
    const bucket = ensure(date);
    bucket.purchaseCount += 1;
    bucket.purchaseTotal += amount;
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
    });
  }

  // 이월 건: order_date(회계상 날짜)가 아니라 created_at(실제 입력일)의
  // 달력 날짜에 정상적인 매출/매입 건과 똑같은 방식으로 끼워 넣는다. 지금
  // 보고 있는 달[monthStart, monthEnd] 범위 안에 입력일이 들어올 때만
  // 반영한다(다른 달을 보는 중이면 여기서 걸러진다).
  for (const item of carryoverSales ?? []) {
    if (!isCarryover(item.sales_orders.order_date, item.sales_orders.created_at)) continue;
    const date = toLocalDateStr(item.sales_orders.created_at);
    if (date < monthStart || date > monthEnd) continue;
    const amount = item.quantity * Number(item.unit_price);
    const bucket = ensure(date);
    bucket.salesCount += 1;
    bucket.salesTotal += amount;
    if (item.products?.sku === PAPER_STOCK_SKU) {
      const partnerName = item.sales_orders.customers?.name ?? "거래처 미상";
      const entry = ensurePaperCalcPartner(bucket.salesPaperCalcByPartner, partnerName);
      entry.amount += amount;
      entry.totalSheet += item.quantity;
      continue;
    }
    bucket.salesItems.push({
      partnerName: item.sales_orders.customers?.name ?? "거래처 미상",
      productName: item.products?.name ?? "상품 미상",
      spec: item.spec || item.products?.spec || "",
      unit: item.products?.unit ?? "",
      quantity: item.quantity,
      amount,
      orderId: item.sales_order_id,
      remark: item.remark,
    });
  }

  for (const item of carryoverPurchases ?? []) {
    if (!isCarryover(item.purchase_orders.purchase_date, item.purchase_orders.created_at)) continue;
    const date = toLocalDateStr(item.purchase_orders.created_at);
    if (date < monthStart || date > monthEnd) continue;
    const amount = item.quantity * Number(item.unit_cost);
    const bucket = ensure(date);
    bucket.purchaseCount += 1;
    bucket.purchaseTotal += amount;
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
    });
  }

  for (const calc of salesPaperCalcs ?? []) {
    const bucket = ensure(calc.sales_orders.order_date);
    const partnerName = calc.sales_orders.customers?.name ?? "거래처 미상";
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

  const todaySalesTotal = (todaySales ?? []).reduce(
    (sum, item) => sum + item.quantity * Number(item.unit_price),
    0
  );
  const todayPurchaseTotal = (todayPurchases ?? []).reduce(
    (sum, item) => sum + item.quantity * Number(item.unit_cost),
    0
  );

  const summaryRows = [
    { label: "오늘 매출", value: `${(todaySales ?? []).length}건 · ${todaySalesTotal.toLocaleString()}원` },
    { label: "오늘 매입", value: `${(todayPurchases ?? []).length}건 · ${todayPurchaseTotal.toLocaleString()}원` },
    { label: "전체 품목 수", value: `${productCount ?? 0}개` },
  ];

  const hasAlerts =
    unreadAnnouncements.length > 0 || dueSoonTodos.length > 0 || lowStockItems.length > 0;

  return (
    <>
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
      <div className="erp-home">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="erp-home-panel">
          <div className="erp-home-panel-title">업무 요약</div>
          {summaryRows.map((row) => (
            <div className="erp-home-stat-row" key={row.label}>
              <span>{row.label}</span>
              <span className="erp-home-stat-value">{row.value}</span>
            </div>
          ))}
        </div>

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
